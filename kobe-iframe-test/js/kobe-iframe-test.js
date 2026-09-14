/**
 * KOBE iframe navigation prototype — /kobe-iframe-test/ ONLY.
 *
 * Shared by all 7 pages under /kobe-iframe-test/ (the entry page + the 6
 * category detail pages). Does not touch, require or modify
 * ../../assets/js/kobe-hero.js or ../../assets/js/jtnp-appbar.js (both reused
 * unmodified for the App Bar / HERO).
 *
 * The bottom 6-menu is now plain internal navigation (<a href>` to each
 * category's own page) — there is no more in-page iframe src switching, so
 * this script's only remaining job is:
 *   Keep --kit-bar-h (used by the iframe/footer bottom padding so the fixed
 *   menu never covers them) in sync with the menu's real rendered height.
 *
 * The 6-menu itself is always visible, fixed to the bottom of the viewport,
 * for the whole page — there is no HERO-based or scroll-based show/hide.
 */
( function () {
	'use strict';

	var menu = document.querySelector( '[data-kit-menu]' );

	if ( ! menu ) {
		return;
	}

	function syncBarHeight() {
		document.documentElement.style.setProperty( '--kit-bar-h', menu.offsetHeight + 'px' );
	}

	syncBarHeight();
	window.addEventListener( 'resize', syncBarHeight );
	if ( window.ResizeObserver ) {
		new ResizeObserver( syncBarHeight ).observe( menu );
	}
}() );
