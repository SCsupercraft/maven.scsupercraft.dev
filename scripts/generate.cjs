const path = require('node:path');
const fs = require('node:fs/promises');

const artifactFolder = path.resolve('./');
const ignored = [
	'.git',
	'.github',
	'_config.yml',
	'CNAME',
	'README.md',
	'index.md',
	'scripts',
	'package.json',
	'package-lock.json',
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
 * Create an index.md file for the specified directory.
 * @param {string} filePath - The path of the directory.
 */
async function forFolder(filePath) {
	const displayPath = path.relative(artifactFolder, filePath);
	const files = (await fs.readdir(filePath)).sort();
	if (files.length == 0) return;

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
					.replaceAll('\\', '»')
					.split('»')
					.reduce((p, c, i, a) => {
						curr += '/' + c;
						return (
							p +
							(p.length == 0 ? '' : ' » ') +
							(a.length - 1 == i ? c : `[${c}](${curr})`)
						);
					}, '');

	let markdown = `# ${breadcrumb}\n`;

	for (let index in dirs) {
		const dir = dirs[index];
		const stats = await fs.stat(path.resolve(filePath, dir));
		const modified = new Date(stats.mtime).toISOString().split('T')[0];

		markdown += `\n- 📁 [${dir}](/${path
			.relative(artifactFolder, path.resolve(filePath, dir))
			.replaceAll('\\', '/')}) - modified ${modified}`;

		await forFolder(path.resolve(filePath, dir));
	}

	for (let index in artifacts) {
		const artifact = artifacts[index];
		const stats = await fs.stat(path.resolve(filePath, artifact));
		const sizeKB = (stats.size / 1024).toFixed(1);
		const modified = new Date(stats.mtime).toISOString().split('T')[0];

		markdown += `\n- 📄 [${artifact}](/${path
			.relative(artifactFolder, path.resolve(filePath, artifact))
			.replaceAll('\\', '/')}) - ${sizeKB} KB, modified ${modified}`;
	}

	markdown +=
		'\n\n## Links:\n- [Github](https://github.com/SCsupercraft/scsupercraft-maven)';

	await fs.writeFile(path.resolve(filePath, 'index.md'), markdown, 'utf-8');
	console.log(
		'Created index for ' + displayPath.length == 0
			? 'root'
			: 'root/' + displayPath
	);
}

forFolder(artifactFolder);
