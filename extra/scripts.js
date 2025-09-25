/*
 * Toggle "sticky" quality of Demo form inputs
 */
function unstickIfNeeded () {
	const target = document.querySelector('#stick');
	const watched = document.querySelector('#unstick');
	if (!target || !watched) return;
	window.addEventListener('scroll', () => {
		const offset = watched.offsetTop - target.offsetHeight;
		if (window.scrollY > offset) {
			target.classList.remove('sticky');
		} else {
			target.classList.add('sticky');
		}
	});
}

/*
 * Convenience functionality for inputs
 */
function upgradeInputs () {
	const inputs = document.querySelectorAll('input');
	for (const input of inputs) {
		input.addEventListener('focus', event => {
			event.target.select();
		});

		input.addEventListener('click', event => {
			event.target.select();
		});

		input.addEventListener('keydown', event => {
			if (event.key === "Enter") {
				event.target.select();
			}
		})
	}
}

/**
 * Grab the README file and stick it in the "instructions" container
 */
function getReadme () {
	const elem = document.querySelector('#instructions');
	fetch ('./README.md')
	.then (response => response.text())
	.then (text => {
		elem.textContent = text;
	});
}

unstickIfNeeded();
upgradeInputs();
getReadme();

