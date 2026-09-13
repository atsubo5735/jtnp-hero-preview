/**
 * KOBE iframe navigation prototype — /kobe-iframe-test/ ONLY.
 *
 * Standalone script for this verification page. Does not touch, require or
 * modify ../assets/js/kobe-hero.js or ../assets/js/jtnp-appbar.js (both
 * reused unmodified by kobe-iframe-test/index.html for the App Bar / HERO).
 *
 * Responsibilities:
 *   1. 6-menu selection -> swap the #kit-frame iframe's src, set the active
 *      button, and set the IFRAME SECTION's background color to match the
 *      selected category, all at once. The KOBE page itself is never
 *      replaced/navigated.
 *   2. Keep --kit-bar-h (used by the iframe section / footer bottom padding
 *      so the fixed menu never covers them) in sync with the menu's real
 *      rendered height.
 *
 * The 6-menu itself is always visible, fixed to the bottom of the viewport,
 * for the whole page (HERO included) — there is no HERO-based show/hide.
 */
( function () {
	'use strict';

	var menu = document.querySelector( '[data-kit-menu]' );
	var items = Array.prototype.slice.call( document.querySelectorAll( '[data-kit-item]' ) );
	var frame = document.getElementById( 'kit-frame' );
	var iframeSection = document.getElementById( 'kit-iframe' );

	if ( ! menu || ! frame ) {
		return;
	}

	/* ------------------------------------------------------- bar height --- */
	function syncBarHeight() {
		document.documentElement.style.setProperty( '--kit-bar-h', menu.offsetHeight + 'px' );
	}

	syncBarHeight();
	window.addEventListener( 'resize', syncBarHeight );
	if ( window.ResizeObserver ) {
		new ResizeObserver( syncBarHeight ).observe( menu );
	}

	/* --------------------------------------------------------- selection --- */
	function isSectionSufficientlyVisible( el ) {
		var rect = el.getBoundingClientRect();
		var vh = window.innerHeight || document.documentElement.clientHeight;
		// "Sufficiently visible" = its top is already within the viewport and
		// at least ~40% of the viewport height of it is showing.
		return rect.top >= 0 && rect.top < vh * 0.6;
	}

	function selectItem( btn ) {
		var src = btn.getAttribute( 'data-kit-src' );
		var color = btn.getAttribute( 'data-kit-color' );
		if ( ! src ) {
			return;
		}

		if ( frame.getAttribute( 'src' ) !== src ) {
			frame.setAttribute( 'src', src );
		}

		if ( iframeSection && color ) {
			iframeSection.setAttribute( 'data-kit-color', color );
		}

		items.forEach( function ( otherBtn ) {
			var isCurrent = otherBtn === btn;
			otherBtn.classList.toggle( 'is-current', isCurrent );
			otherBtn.setAttribute( 'aria-pressed', isCurrent ? 'true' : 'false' );
		} );

		if ( iframeSection && ! isSectionSufficientlyVisible( iframeSection ) ) {
			iframeSection.scrollIntoView( { behavior: 'smooth', block: 'start' } );
		}
	}

	items.forEach( function ( btn ) {
		btn.addEventListener( 'click', function () {
			selectItem( btn );
		} );
	} );
}() );
