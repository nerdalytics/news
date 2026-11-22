function isIosHomeScreenApp(): boolean {
	return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function openInBrowser(url: string): void {
	if (isIosHomeScreenApp()) location.assign(`x-safari-${url}`)
	else window.open(url, '_blank', 'noopener')
}
