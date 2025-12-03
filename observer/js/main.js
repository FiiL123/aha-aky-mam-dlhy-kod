window.addEventListener('load', () => {
    // Check for redirect URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('back');

    // Always create the observer with redirect URL
    window.gameObserver = new SpaceGameObserver(redirectUrl);
});