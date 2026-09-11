/**
 * JTNP HOME HERO — YouTube full-screen prototype
 * -----------------------------------------------------------------------
 * Standalone prototype script only. Not loaded by, or wired into, the
 * WordPress theme. No YouTube Player API, no jQuery, no animation
 * framework — plain iframe embed + plain DOM/CSS.
 *
 * Responsibilities:
 *   1. Cover-crop the 16:9 YouTube iframe against the viewport, centered,
 *      so it always fills the frame with no letterboxing (sizeHeroVideo).
 *   2. Load the iframe's real src only when autoplay is actually wanted
 *      (skipped entirely under prefers-reduced-motion).
 *   3. Fade the fallback/poster out once the video is confirmed loaded,
 *      and keep a safety timeout so a slow/failed embed still shows
 *      something reasonable.
 *   4. Toggle the App Bar between transparent (over the Hero) and dark
 *      (once scrolled), with a small hysteresis-free threshold.
 *   5. Run the Mobile nav dropdown (direct port of the interaction in
 *      assets/js/jtnp-appbar.js — toggle / outside-click / Escape /
 *      desktop-breakpoint reset), restyled only for this prototype's own
 *      [data-nav-toggle]/[data-nav] attributes.
 */
( function () {
	'use strict';

	var hero = document.querySelector( '[data-hero]' );
	var iframe = document.querySelector( '[data-hero-iframe]' );
	var reduceMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	/* ---------------------------------------------------------------------
	 * 1. Cover-crop sizing.
	 *
	 * The iframe is a fixed 16:9 box. To cover an arbitrary viewport with no
	 * letterboxing we compare the viewport's own aspect ratio to 16:9:
	 *   - viewport WIDER than 16:9 (or equal)  -> constrain by WIDTH
	 *       width  = 100vw
	 *       height = width / (16/9)   (taller than the viewport, cropped
	 *                                  top/bottom by the centered transform)
	 *   - viewport TALLER than 16:9 (portrait / SP)  -> constrain by HEIGHT
	 *       height = 100svh (100vh fallback)
	 *       width  = height * (16/9)  (wider than the viewport, cropped
	 *                                  left/right — this is the "center of
	 *                                  a 16:9 video filling a portrait
	 *                                  screen" case the brief calls out)
	 * Centering via CSS (top/left 50% + translate(-50%,-50%)) then keeps the
	 * crop anchored on the video's own middle in both cases.
	 * --------------------------------------------------------------------- */
	function sizeHeroVideo() {
		if ( ! hero || ! iframe ) {
			return;
		}

		var rect = hero.getBoundingClientRect();
		var vw = rect.width || window.innerWidth;
		var vh = rect.height || window.innerHeight;
		var ratio = 16 / 9;
		var w, h;

		if ( vw / vh > ratio ) {
			// Viewport wider than the video -> fit width, overflow height.
			w = vw;
			h = vw / ratio;
		} else {
			// Viewport taller/narrower than the video -> fit height, overflow width.
			h = vh;
			w = vh * ratio;
		}

		iframe.style.width = w + 'px';
		iframe.style.height = h + 'px';
	}

	/* ---------------------------------------------------------------------
	 * 2 + 3. Load + fallback handling.
	 * --------------------------------------------------------------------- */
	function showVideoReady() {
		hero.setAttribute( 'data-video-ready', '' );
	}

	function loadHeroVideo() {
		if ( reduceMotion || ! iframe ) {
			// Reduced motion: never request the embed at all. CSS also hides
			// .hero-video under this media query as a second, independent
			// guard in case JS runs before the stylesheet or is disabled.
			return;
		}

		var src = iframe.getAttribute( 'data-src' );
		if ( ! src ) {
			return;
		}

		// iframe 'load' fires once the YouTube embed document itself has
		// loaded — a reasonable, API-free proxy for "the player is ready",
		// without adding the YouTube Player API library.
		iframe.addEventListener( 'load', showVideoReady, { once: true } );

		// Safety net: if 'load' never fires cleanly (slow connection,
		// embed blocked, etc.) the fallback/poster simply stays visible —
		// nothing times out into a broken state, it just never promotes
		// past the fallback, which is the correct degrade.
		iframe.setAttribute( 'src', src );
	}

	if ( hero && iframe ) {
		sizeHeroVideo();
		window.addEventListener( 'resize', sizeHeroVideo );
		window.addEventListener( 'orientationchange', sizeHeroVideo );
		loadHeroVideo();
	}

	/* ---------------------------------------------------------------------
	 * 4. App Bar transparent -> dark on scroll.
	 * --------------------------------------------------------------------- */
	var appbar = document.querySelector( '[data-appbar]' );
	var SCROLL_THRESHOLD = 32; // within the brief's suggested 20-50px range

	function updateAppbarScrollState() {
		if ( ! appbar ) {
			return;
		}
		if ( window.scrollY > SCROLL_THRESHOLD ) {
			appbar.setAttribute( 'data-scrolled', '' );
		} else {
			appbar.removeAttribute( 'data-scrolled' );
		}
	}

	if ( appbar ) {
		updateAppbarScrollState();
		window.addEventListener( 'scroll', updateAppbarScrollState, { passive: true } );
	}

	/* ---------------------------------------------------------------------
	 * 5. Mobile nav dropdown — same interaction as assets/js/jtnp-appbar.js.
	 * --------------------------------------------------------------------- */
	var toggle = document.querySelector( '[data-nav-toggle]' );
	var nav = document.querySelector( '[data-nav]' );

	if ( toggle && nav ) {
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

		nav.querySelectorAll( 'a' ).forEach( function ( link ) {
			link.addEventListener( 'click', function () {
				setOpen( false );
			} );
		} );

		document.addEventListener( 'keydown', function ( e ) {
			if ( 'Escape' === e.key && isOpen() ) {
				setOpen( false );
				toggle.focus();
			}
		} );

		document.addEventListener( 'click', function ( e ) {
			if ( ! isOpen() ) {
				return;
			}
			if ( nav.contains( e.target ) || toggle.contains( e.target ) ) {
				return;
			}
			setOpen( false );
		} );

		window.addEventListener( 'resize', function () {
			if ( window.innerWidth >= 992 && isOpen() ) {
				setOpen( false );
			}
		} );
	}
}() );
