/**
 * JTNP HOME prototype — HERO YouTube background + App-Bar-over-HERO
 * -----------------------------------------------------------------------
 * Standalone prototype script only. Not part of the WordPress theme.
 *
 * Responsibilities:
 *
 *   1. Load the YouTube IFrame Player API and create the background player
 *      muted/looped/controls-hidden — but keep it at opacity:0 (CSS,
 *      hero-override.css) and the fallback/poster layer on top, until the
 *      Player API reports state PLAYING. Only then does [data-video-ready]
 *      go on the slide, fading the real video in and the fallback out.
 *      This is what keeps YouTube's own initial play/pause/scrub control
 *      flash from ever reaching the visitor — no CSS reaches into the
 *      iframe's own document to hide it, which is not reliably possible
 *      cross-origin and is deliberately not attempted here.
 *   2. If autoplay is blocked or the API/embed fails, the fallback simply
 *      stays visible — never a broken/blank state.
 *   3. Cover-crop the 16:9 player against the HERO frame, centered, so it
 *      always fills the frame with no letterboxing at any breakpoint
 *      (Desktop full viewport / SP 100svh portrait, center-cropped).
 *   4. Toggle the App Bar between transparent (over the HERO) and the
 *      theme's own dark background (once scrolled past the HERO).
 */
( function () {
	'use strict';

	var YT_VIDEO_ID = 'wGupxN7yHWI';

	var hero = document.querySelector( '[data-hero]' );
	var mount = document.querySelector( '[data-hero-yt-mount]' );
	var reduceMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	var player = null;
	var iframeEl = null;

	/* ---------------------------------------------------------------------
	 * 3. Cover-crop sizing — applied to the Player API's own iframe once it
	 * exists, and re-applied on resize.
	 * --------------------------------------------------------------------- */
	function sizeHeroVideo() {
		if ( ! hero || ! iframeEl ) {
			return;
		}

		var rect = hero.getBoundingClientRect();
		var vw = rect.width || window.innerWidth;
		var vh = rect.height || window.innerHeight;
		var ratio = 16 / 9;
		var w, h;

		if ( vw / vh > ratio ) {
			w = vw;
			h = vw / ratio;
		} else {
			h = vh;
			w = vh * ratio;
		}

		iframeEl.style.width = w + 'px';
		iframeEl.style.height = h + 'px';
	}

	/* ---------------------------------------------------------------------
	 * 1 + 2. YouTube IFrame Player API — minimal use: create the player,
	 * watch for PLAYING, reveal only then.
	 * --------------------------------------------------------------------- */
	function showVideoReady() {
		if ( hero ) {
			hero.setAttribute( 'data-video-ready', '' );
		}
	}

	function hideVideo() {
		if ( hero ) {
			hero.removeAttribute( 'data-video-ready' );
		}
	}

	function onPlayerStateChange( event ) {
		if ( window.YT && event.data === window.YT.PlayerState.PLAYING ) {
			// Short delay after PLAYING is confirmed, per the brief: makes sure
			// the very first decoded frame (not YouTube's own UI) is what
			// fades in.
			window.setTimeout( showVideoReady, 220 );
		} else if ( window.YT && ( event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.BUFFERING ) ) {
			// Stay on the fallback until PLAYING is reached again — covers a
			// stall/rebuffer without ever showing a frozen/blank video frame.
		}
	}

	function onPlayerError() {
		// Autoplay blocked / embed failed: keep the fallback, never surface a
		// broken player.
		hideVideo();
	}

	function onPlayerReady( event ) {
		iframeEl = event.target.getIframe();
		iframeEl.setAttribute( 'tabindex', '-1' );
		iframeEl.setAttribute( 'aria-hidden', 'true' );
		sizeHeroVideo();
		event.target.mute();
		event.target.playVideo();
	}

	function createPlayer() {
		if ( ! mount || ! window.YT || ! window.YT.Player ) {
			return;
		}

		player = new window.YT.Player( mount, {
			videoId: YT_VIDEO_ID,
			playerVars: {
				autoplay: 1,
				mute: 1,
				loop: 1,
				playlist: YT_VIDEO_ID, // required by the API for loop to work on a single video
				controls: 0,
				disablekb: 1,
				playsinline: 1,
				rel: 0,
				modestbranding: 1,
				iv_load_policy: 3,
				fs: 0
			},
			events: {
				onReady: onPlayerReady,
				onStateChange: onPlayerStateChange,
				onError: onPlayerError
			}
		} );
	}

	function loadYouTubeApi() {
		if ( reduceMotion || ! mount ) {
			// Reduced motion: never request the embed at all — CSS also hides
			// .hero-video under this same media query as a second,
			// independent guard.
			return;
		}

		if ( window.YT && window.YT.Player ) {
			createPlayer();
			return;
		}

		// Standard YouTube IFrame Player API bootstrap: this global callback
		// name is fixed by the API itself.
		var previousCallback = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = function () {
			if ( typeof previousCallback === 'function' ) {
				previousCallback();
			}
			createPlayer();
		};

		var tag = document.createElement( 'script' );
		tag.src = 'https://www.youtube.com/iframe_api';
		var firstScript = document.getElementsByTagName( 'script' )[ 0 ];
		firstScript.parentNode.insertBefore( tag, firstScript );
	}

	if ( hero && mount ) {
		window.addEventListener( 'resize', sizeHeroVideo );
		window.addEventListener( 'orientationchange', sizeHeroVideo );
		loadYouTubeApi();
	}

	/* ---------------------------------------------------------------------
	 * 4. App Bar transparent (over HERO) -> dark (scrolled past it).
	 * --------------------------------------------------------------------- */
	var appbar = document.querySelector( '[data-jtnp-appbar]' );
	var appbarBlk = document.querySelector( '.jtnp-appbar-blk' );

	// Measures the App Bar's own real rendered height (60px Mobile / 68px
	// Tablet / 74px Desktop per its own CSS comment) and writes it to
	// --jtnp-appbar-h, which hero-override.css uses for the negative
	// bottom margin that pulls the HERO up underneath it. Re-measured on
	// resize since the height changes at each breakpoint.
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
