/** Safari on iOS and iPadOS sets this on a page that runs as a home screen web app. */
function isIosHomeScreenApp(): boolean {
	return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * Opens a link outside the app.
 *
 * In a browser tab that is a new tab. A home screen web app on iOS opens every
 * link in its own built-in view, so there the link goes through the
 * `x-safari-https:` address, which hands it to Safari. Apple does not document
 * that address. If it stops working, nothing opens.
 */
export function openInBrowser(url: string): void {
	if (isIosHomeScreenApp()) location.assign(`x-safari-${url}`)
	else window.open(url, '_blank', 'noopener')
}
