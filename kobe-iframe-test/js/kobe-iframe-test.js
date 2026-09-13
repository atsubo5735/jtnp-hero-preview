/**
 * KOBE iframe navigation prototype — /kobe-iframe-test/ ONLY.
 *
 * Standalone script for this verification page. Does not touch, require or
 * modify ../assets/js/kobe-hero.js or ../assets/js/jtnp-appbar.js (both
 * reused unmodified by kobe-iframe-test/index.html for the App Bar / HERO).
 *
 * Responsibilities:
 *   1. Bottom Sheet open/close (collapsed thin bar <-> expanded 6-menu).
 *      The handle bar itself is the only open/close control (relabeled
 *      開く ▲ / 閉じる ▼), staying pinned to the true viewport bottom in
 *      both states; [data-open] on .kit-menu drives all animation in CSS.
 *   2. 6-menu selection -> swap the #kit-frame iframe's src only; the KOBE
 *      page itself is never replaced/navigated.
 *   3. After selecting, smooth-scroll the iframe section into view (skipped
 *      if it is already sufficiently on screen, so this never fights the
 *      user with an unnecessary jump) and auto-close the Bottom Sheet on
 *      narrow (smartphone-width) viewports so it does not keep covering the
 *      newly-loaded external site.
 */
( function () {
	'use strict';

	var menu = document.querySelector( '[data-kit-menu]' );
	var toggleBtn = document.querySelector( '[data-kit-menu-toggle]' );
	var toggleWord = document.querySelector( '[data-kit-menu-toggle-word]' );
	var items = Array.prototype.slice.call( document.querySelectorAll( '[data-kit-item]' ) );
	var frame = document.getElementById( 'kit-frame' );
	var iframeSection = document.getElementById( 'kit-iframe' );

	if ( ! menu || ! toggleBtn || ! frame ) {
		return;
	}

	var SMARTPHONE_MAX_WIDTH = 640;

	function isOpen() {
		return menu.hasAttribute( 'data-open' );
	}

	function setOpen( open ) {
		if ( open ) {
			menu.setAttribute( 'data-open', '' );
		} else {
			menu.removeAttribute( 'data-open' );
		}
		toggleBtn.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
		if ( toggleWord ) {
			toggleWord.textContent = open ? '閉じる' : '開く';
		}
	}

	toggleBtn.addEventListener( 'click', function () {
		setOpen( ! isOpen() );
	} );

	// Escape closes, same pattern as the App Bar's mobile nav.
	document.addEventListener( 'keydown', function ( e ) {
		if ( 'Escape' === e.key && isOpen() ) {
			setOpen( false );
			toggleBtn.focus();
		}
	} );

	function isSectionSufficientlyVisible( el ) {
		var rect = el.getBoundingClientRect();
		var vh = window.innerHeight || document.documentElement.clientHeight;
		// "Sufficiently visible" = its top is already within the viewport and
		// at least ~40% of the viewport height of it is showing.
		return rect.top >= 0 && rect.top < vh * 0.6;
	}

	function selectItem( btn ) {
		var src = btn.getAttribute( 'data-kit-src' );
		if ( ! src ) {
			return;
		}

		if ( frame.getAttribute( 'src' ) !== src ) {
			frame.setAttribute( 'src', src );
		}

		items.forEach( function ( otherBtn ) {
			var isCurrent = otherBtn === btn;
			otherBtn.classList.toggle( 'is-current', isCurrent );
			otherBtn.setAttribute( 'aria-pressed', isCurrent ? 'true' : 'false' );
		} );

		var isSmartphone = window.matchMedia && window.matchMedia( '(max-width: ' + SMARTPHONE_MAX_WIDTH + 'px)' ).matches;

		if ( isSmartphone ) {
			// Close first so the sheet does not keep covering the freshly
			// loaded external site, then scroll once it has collapsed.
			setOpen( false );
			window.setTimeout( function () {
				if ( iframeSection && ! isSectionSufficientlyVisible( iframeSection ) ) {
					iframeSection.scrollIntoView( { behavior: 'smooth', block: 'start' } );
				}
			}, 220 );
		} else if ( iframeSection && ! isSectionSufficientlyVisible( iframeSection ) ) {
			iframeSection.scrollIntoView( { behavior: 'smooth', block: 'start' } );
		}
	}

	items.forEach( function ( btn ) {
		btn.addEventListener( 'click', function () {
			selectItem( btn );
		} );
	} );
}() );
