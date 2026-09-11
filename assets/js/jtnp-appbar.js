/**
 * JTNP Global Component — App Bar Mobile Navigation
 *
 * Shared, unmodified, by the national top and every JTNP Area Page — loaded
 * on the same gate as every other Global Component script (Explore Japan
 * MAP, News, …), inc/jtnp-area-assets.php.
 *
 * Sticky positioning itself is pure CSS (position: sticky — see .appbar in
 * assets/css/jtnp-area.css); this script only runs the compact Mobile/Tablet
 * Navigation pattern below the >= 992px breakpoint where the four-link
 * .ab-nav is shown inline instead (0.7.1 brief §4). Below that width .ab-nav
 * is a dropdown panel, closed by default, toggled by a hamburger button —
 * this is what keeps four navigation links from ever being squeezed into one
 * row at 390px or causing horizontal overflow.
 */
( function () {
	'use strict';

	var toggle = document.querySelector( '[data-jtnp-nav-toggle]' );
	var nav = document.querySelector( '[data-jtnp-nav]' );
	if ( ! toggle || ! nav ) {
		return;
	}

	function isOpen() {
		return 'true' === toggle.getAttribute( 'aria-expanded' );
	}

	function setOpen( open ) {
		toggle.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
		var label = open ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
		if ( label ) {
			toggle.setAttribute( 'aria-label', label );
		}
		if ( open ) {
			nav.setAttribute( 'data-open', '' );
		} else {
			nav.removeAttribute( 'data-open' );
		}
	}

	toggle.addEventListener( 'click', function () {
		setOpen( ! isOpen() );
	} );

	// Close after choosing a destination — the link's own default navigation
	// (in-page anchor scroll, or the cross-page About JTNP link) still runs;
	// this only tidies the now-irrelevant open panel out of the way for
	// visitors who navigate back.
	nav.querySelectorAll( '[data-jtnp-nav-link]' ).forEach( function ( link ) {
		link.addEventListener( 'click', function () {
			setOpen( false );
		} );
	} );

	// Escape closes, and returns focus to the toggle so keyboard users are
	// not left with focus inside a now-hidden panel.
	document.addEventListener( 'keydown', function ( e ) {
		if ( 'Escape' === e.key && isOpen() ) {
			setOpen( false );
			toggle.focus();
		}
	} );

	// Outside click closes. Uses the capture-free 'click' on document rather
	// than 'pointerdown' so a click that starts inside the panel and ends
	// outside (a drag-select) does not close it prematurely.
	document.addEventListener( 'click', function ( e ) {
		if ( ! isOpen() ) {
			return;
		}
		if ( nav.contains( e.target ) || toggle.contains( e.target ) ) {
			return;
		}
		setOpen( false );
	} );

	// A resize past the Desktop breakpoint (>= 992px, where .ab-nav becomes
	// the always-visible inline row and .ab-navtoggle is hidden by CSS) still
	// leaves the dropdown's own open/closed state and aria-expanded stale
	// underneath the CSS override — reset both so returning below 992px does
	// not show a dropdown nobody opened.
	var desktop = window.matchMedia( '(min-width: 992px)' );
	function syncToDesktop( mql ) {
		if ( mql.matches ) {
			setOpen( false );
		}
	}
	syncToDesktop( desktop );
	if ( desktop.addEventListener ) {
		desktop.addEventListener( 'change', syncToDesktop );
	} else if ( desktop.addListener ) {
		// Safari < 14.
		desktop.addListener( syncToDesktop );
	}
}() );
