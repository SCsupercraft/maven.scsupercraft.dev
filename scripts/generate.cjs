const path = require('node:path');
const fs = require('node:fs/promises');

const artifactFolder = path.resolve('./artifacts');

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

async function forFolder(/** @type {string} */ filePath) {
	const displayPath = path.relative(artifactFolder, filePath);
	const files = await fs.readdir(filePath);
	const dirs = [];
	const artifacts = [];

	for (let i in files) {
		const file = files[i];
		const pathType = await getPathType(path.resolve(filePath, file));
		switch (pathType) {
			case 'directory': {
				dirs.push(file);
				break;
			}
			case 'file': {
				if (file != 'index.md') artifacts.push(file);
				break;
			}
		}
	}

	let curr = '';
	const breadcrumb =
		displayPath.length == 0
			? 'Root'
			: displayPath
					.replaceAll('/', '»')
					.replaceAll('\\', '»')
					.split('»')
					.reduce((p, c, i, a) => {
						curr += '/' + c;
						return (
							p +
							(p.length == 0 ? '' : ' » ') +
							(a.length - 1 == i
								? c
								: `[${c}](/artifacts${curr})`)
						);
					}, '');

	let markdown = `# ${breadcrumb}\n\n`;

	dirs.forEach((dir) => {
		markdown += `\n- 📁 [${dir}](/artifacts/${path
			.relative(artifactFolder, path.resolve(filePath, dir))
			.replaceAll('\\', '/')})`;
		forFolder(path.resolve(filePath, dir));
	});

	if (dirs.length > 0 && artifacts.length > 0) markdown += '\n\n';

	artifacts.forEach((artifact) => {
		markdown += `\n- 📄 [${artifact}](/artifacts/${path
			.relative(artifactFolder, path.resolve(filePath, artifact))
			.replaceAll('\\', '/')})`;
	});

	await fs.writeFile(path.resolve(filePath, 'index.md'), markdown, 'utf-8');
	console.log('Created index for ' + filePath);
}

forFolder(artifactFolder);
