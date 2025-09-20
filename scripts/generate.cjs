const path = require('node:path');
const fs = require('node:fs/promises');
const unzip = require('extract-zip');

const artifactFolder = path.resolve('./');
const ignored = [
	'.git',
	'.github',
	'.gitignore',
	'_config.yml',
	'_layouts',
	'CNAME',
	'README.md',
	'404.md',
	'index.md',
	'scripts',
	'changelog',
	'package.json',
	'package-lock.json',
	'node_modules',
];
const packages = [];

/**
 * Determines whether a given path is a file or a folder.
 * @param {string} path - The path to check.
 * @returns {Promise<'file' | 'directory' | 'unknown'>}
 */
async function getPathType(path) {
	try {
		const stats = await fs.stat(path);
		if (stats.isFile()) return 'file';
		if (stats.isDirectory()) return 'directory';
		return 'unknown';
	} catch (err) {
		console.error(`Error checking path: ${path}`, err);
		return 'unknown';
	}
}

/**
 * Extracts Javadoc JARs into a sibling 'javadoc/' folder.
 * @param {string} jarPath - Full path to the Javadoc JAR file.
 * @returns {Promise<boolean>} - Was the file a Javadoc JAR?
 */
async function extractJavadocJar(jarPath) {
	if (!jarPath.endsWith('-javadoc.jar')) return false;
	const targetDir = path.join(path.dirname(jarPath), 'javadoc');

	try {
		await fs.mkdir(targetDir, { recursive: true });
		await unzip(jarPath, { dir: targetDir });
		await addIcon(targetDir);
		console.log(
			`Extracted Javadoc to root/${path.posix.relative(
				artifactFolder,
				targetDir
			)}`
		);
		return true;
	} catch (err) {
		console.error(
			`Failed to extract Javadoc from root/${path.posix.relative(
				artifactFolder,
				jarPath
			)}`,
			err
		);
		return false;
	}
}

/**
 * Adds favicon link to all HTML files in a directory.
 * @param {string} javadocDir - Path to the unpacked javadoc folder.
 */
async function addIcon(javadocDir) {
	const files = await fs.readdir(javadocDir, { withFileTypes: true });

	for (const file of files) {
		const fullPath = path.join(javadocDir, file.name);
		const displayPath = path.posix.relative(artifactFolder, fullPath);

		if (file.isDirectory()) {
			await addIcon(fullPath); // recurse into subfolders
		} else if (file.isFile() && file.name.endsWith('.html')) {
			try {
				let html = await fs.readFile(fullPath, 'utf-8');

				// Inject favicon link into <head>
				html = html.replace(
					/<head[^>]*>/i,
					(match) =>
						`${match}\n<link rel="icon" type="image/png" href="https://www.scsupercraft.dev/logo.png">`
				);

				await fs.writeFile(fullPath, html, 'utf-8');
				console.log(`Injected favicon into root/${displayPath}`);
			} catch (err) {
				console.error(
					`Failed to inject favicon into root/${displayPath}`,
					err
				);
			}
		}
	}
}

/**
 * Create an index.md file for the specified directory.
 * @param {string} filePath - The path of the directory.
 */
async function forFolder(filePath) {
	const displayPath = path.posix.relative(artifactFolder, filePath);
	const files = (await fs.readdir(filePath)).sort();
	if (files.length == 0) {
		console.log(
			'Skipped empty directory: ' +
				(displayPath.length == 0 ? 'root' : 'root/' + displayPath)
		);
		return;
	}
	if (displayPath.length != 0) {
		packages.push(displayPath);
	}

	const dirs = [];
	const artifacts = [];

	for (let i in files) {
		const file = files[i];
		if (ignored.includes(file)) continue;

		const pathType = await getPathType(path.resolve(filePath, file));
		switch (pathType) {
			case 'directory': {
				dirs.push(file);
				break;
			}
			case 'file': {
				artifacts.push(file);
				break;
			}
		}
	}

	let curr = '';
	const breadcrumb =
		displayPath.length == 0
			? 'root'
			: '[root](/) » ' +
			  displayPath
					.replaceAll('/', '»')
					.split('»')
					.reduce((p, c, i, a) => {
						curr += '/' + c;
						return (
							p +
							(p.length == 0 ? '' : ' » ') +
							(a.length - 1 == i ? c : `[${c}](${curr})`)
						);
					}, '');

	let markdown = `---\nlayout: default\n---\n\n# ${breadcrumb}\n`;

	for (let dir of dirs) {
		const fullPath = path.resolve(filePath, dir);
		const stats = await fs.stat(fullPath);
		const modified = new Date(stats.mtime).toISOString().split('T')[0];

		markdown += `\n- 📁 [${dir}](/${path.posix.relative(
			artifactFolder,
			fullPath
		)}) - modified ${modified}`;

		await forFolder(fullPath);
	}

	let hasJavadoc = false;
	for (let artifact of artifacts) {
		const fullPath = path.resolve(filePath, artifact);
		const stats = await fs.stat(fullPath);
		const sizeKB = (stats.size / 1024).toFixed(1);
		const modified = new Date(stats.mtime).toISOString().split('T')[0];
		const isJavadoc = !hasJavadoc && (await extractJavadocJar(fullPath));
		if (isJavadoc) hasJavadoc = true;

		markdown += `\n- 📄 [${artifact}](/${path.posix.relative(
			artifactFolder,
			fullPath
		)}) - ${sizeKB} KB, modified ${modified}`;
	}

	if (hasJavadoc) {
		const javadocRel = path.posix.relative(
			artifactFolder,
			path.resolve(filePath, 'javadoc')
		);
		markdown += `\n- 📖 <a href="/${javadocRel}/index.html" target="_blank" rel="noopener noreferrer">View Javadoc</a>`;
	}
	if (files.includes('changelog'))
		markdown += `\n- 🧾 <a href="${await fs.readFile(
			path.resolve(filePath, 'changelog'),
			'utf-8'
		)}" target="_blank" rel="noopener noreferrer">View Changelog</a>`;

	markdown +=
		'\n\n## Links:\n- [Github](https://github.com/SCsupercraft/maven.scsupercraft.dev)\n- [Main Site](https://www.scsupercraft.dev)';

	await fs.writeFile(path.resolve(filePath, 'index.md'), markdown, 'utf-8');
	console.log(
		'Created index for ' +
			(displayPath.length == 0 ? 'root' : 'root/' + displayPath)
	);
}

forFolder(artifactFolder);
await fs.writeFile(
	path.resolve(artifactFolder, 'search-index.json'),
	JSON.stringify(packages),
	'utf-8'
);
console.log('Created search index with ' + packages.length + ' packages');
