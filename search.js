fetch('/search-index.json')
	.then((res) => res.json())
	.then((/** @type {string[]} */ data) => {
		const input = document.getElementById('search');
		const results = document.getElementById('results');
		const current = document.location.pathname.substring(1).toLowerCase();
		let timeout;

		const escapeHTML = (/** @type {string} */ str) =>
			str
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');

		input.addEventListener('input', () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				const query = input.value.toLowerCase();
				results.innerHTML = '';

				if (query == '') {
					const li = document.createElement('li');
					li.innerHTML = 'Start searching to get results!';
					results.appendChild(li);
					return;
				}

				const filtered = data.filter(
					(item) =>
						item.toLowerCase().startsWith(current) &&
						item.toLowerCase().includes(query)
				);

				if (filtered.length > 0)
					filtered.forEach((item) => {
						const li = document.createElement('li');
						const highlighted = item.replace(
							query,
							`<strong>${query}</strong>`
						);
						li.innerHTML = `<a href="/${item}">${escapeHTML(
							highlighted
						)}</a>`;
						results.appendChild(li);
					});
				else {
					const li = document.createElement('li');
					li.innerHTML =
						'No results! Try searching for something else.';
					results.appendChild(li);
				}
			}, 150);
		});
	});
