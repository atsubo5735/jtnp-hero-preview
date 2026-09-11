/**
 * KOBE prototype — HTML5 MP4 HERO background + App Bar over-HERO behaviour.
 *
 * Standalone prototype script. Does not touch, require or load
 * ../assets/js/hero.js (the HOME YouTube HERO's own script) — the two HERO
 * implementations are completely independent, per this task's own brief
 * ("現在のHOME YouTube prototypeも変更しません").
 *
 * Responsibilities:
 *   1. Autoplay the muted, looping <video> — the HTML autoplay/muted/loop/
 *      playsinline attributes are not relied on alone; muted is also forced
 *      and play() is called explicitly from JS, with its rejected Promise
 *      caught so a browser that blocks autoplay never throws or breaks the
 *      rest of the page.
 *   2. IntersectionObserver — pause the video once the HERO scrolls out of
 *      view, resume (best-effort) once it scrolls back in.
 *   3. App Bar: transparent while over the HERO, the theme's own existing
 *      dark gradient (kobe-hero-override.css) once scrolled past it — same
 *      technique as ../assets/js/hero.js uses for HOME, reimplemented here
 *      independently since that file is HOME-only.
 *
 * On any playback failure the HERO text, App Bar and the rest of the page
 * are unaffected — the video element is simply hidden, revealing the
 * existing .hero-fallback gradient underneath (see kobe-hero-override.css).
 */
( function () {
	'use strict';

	var hero = document.querySelector( '.jtnp-kobe-hero-blk .hero' );
	var video = document.querySelector( '[data-hero-video]' );
	var reduceMotion = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	function hideVideo() {
		if ( video ) {
			video.style.display = 'none';
		}
	}

	function safePlay() {
		if ( ! video || reduceMotion ) {
			return;
		}
		video.muted = true;
		var playPromise = video.play();
		if ( playPromise && typeof playPromise.catch === 'function' ) {
			playPromise.catch( function () {
				// Autoplay blocked or another transient failure — leave the
				// fallback gradient showing, HERO text/App Bar unaffected.
			} );
		}
	}

	function setUpIntersectionObserver() {
		if ( ! hero || ! video || ! ( 'IntersectionObserver' in window ) ) {
			return;
		}

		var observer = new window.IntersectionObserver( function ( entries ) {
			entries.forEach( function ( entry ) {
				if ( entry.isIntersecting ) {
					safePlay();
				} else if ( ! video.paused ) {
					try {
						video.pause();
					} catch ( err ) { /* no-op */ }
				}
			} );
		}, { threshold: 0.15 } );

		observer.observe( hero );
	}

	if ( video ) {
		video.addEventListener( 'error', hideVideo );

		if ( reduceMotion ) {
			hideVideo();
		} else {
			safePlay();
			document.addEventListener( 'visibilitychange', function () {
				if ( document.visibilityState === 'visible' ) {
					safePlay();
				}
			} );
		}

		setUpIntersectionObserver();
	}

	/* --------------------------------------------------------------------
	 * App Bar: transparent (over HERO) -> dark (scrolled past it).
	 * -------------------------------------------------------------------- */
	var appbar = document.querySelector( '[data-jtnp-appbar]' );
	var appbarBlk = document.querySelector( '.jtnp-appbar-blk' );

	function syncAppbarHeight() {
		if ( ! appbarBlk ) {
			return;
		}
		var h = appbarBlk.getBoundingClientRect().height;
		if ( h > 0 ) {
			document.documentElement.style.setProperty( '--jtnp-appbar-h', h + 'px' );
		}
	}

	function updateAppbarScrollState() {
		if ( ! appbar ) {
			return;
		}
		var threshold = hero ? Math.max( hero.getBoundingClientRect().height - 80, 40 ) : 32;
		if ( window.scrollY > threshold ) {
			appbar.setAttribute( 'data-jtnp-scrolled', '' );
		} else {
			appbar.removeAttribute( 'data-jtnp-scrolled' );
		}
	}

	syncAppbarHeight();
	window.addEventListener( 'resize', syncAppbarHeight );

	if ( appbar ) {
		updateAppbarScrollState();
		window.addEventListener( 'scroll', updateAppbarScrollState, { passive: true } );
		window.addEventListener( 'resize', updateAppbarScrollState );
	}
}() );
