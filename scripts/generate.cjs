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
	'index.md',
	'scripts',
	'package.json',
	'package-lock.json',
	'node_modules',
];

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

	const dirs = [];
	const artifacts = [];

	const javadocRel = path.posix.relative(
		artifactFolder,
		path.resolve(filePath, 'javadoc')
	);

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
		)}) - ${sizeKB} KB, modified ${modified}${
			isJavadoc ? `, [view javadoc](/${javadocRel}/index.html)` : ''
		}`;
	}

	markdown +=
		'\n\n## Links:\n- [Github](https://github.com/SCsupercraft/scsupercraft-maven)';

	await fs.writeFile(path.resolve(filePath, 'index.md'), markdown, 'utf-8');
	console.log(
		'Created index for ' +
			(displayPath.length == 0 ? 'root' : 'root/' + displayPath)
	);
}

forFolder(artifactFolder);
