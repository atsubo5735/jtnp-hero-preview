/**
 * JTNP HOME prototype — HERO YouTube background + App-Bar-over-HERO
 * -----------------------------------------------------------------------
 * Standalone prototype script only. Not part of the WordPress theme.
 *
 * Responsibilities:
 *
 *   1. Load the YouTube IFrame Player API and create the background player
 *      muted/looped/controls-hidden/playsinline, reliably satisfying mobile
 *      autoplay policy (Mobile Safari / Chrome for Android). Player is
 *      created exactly once, after both the API is ready and the DOM mount
 *      point exists — no double-instantiation race.
 *   2. Keep the real player at opacity:0 (CSS, hero-override.css) and the
 *      fallback/poster layer on top until playback is CONFIRMED stable
 *      (PlayerState.PLAYING held for ~400ms). Only then does
 *      [data-video-ready] go on the slide, fading the real video in and the
 *      fallback out. This is what keeps YouTube's own initial
 *      play/pause/scrub/title UI flash — visible during any BUFFERING/
 *      PAUSED/UNSTARTED moment — from ever reaching the visitor. No CSS
 *      reaches into the iframe's own document to hide that UI (not
 *      reliably possible cross-origin and deliberately not attempted);
 *      instead the whole iframe is hidden/shown by Player State.
 *   3. If autoplay is blocked or the API/embed fails, the fallback simply
 *      stays visible — HERO text/CTA/App Bar are never affected — never a
 *      broken/blank state.
 *   4. Cover-crop the 16:9 player against the HERO frame, centered, so it
 *      always fills the frame with no letterboxing at any breakpoint
 *      (Desktop full viewport / SP 100svh portrait, center-cropped, left/
 *      right crop on a landscape source).
 *   5. Toggle the App Bar between transparent (over the HERO) and the
 *      theme's own dark background (once scrolled past the HERO).
 */
( function () {
	'use strict';

	var YT_VIDEO_ID = 'wGupxN7yHWI';
	var STABLE_PLAYING_MS = 400; // brief item 7: iframe only shown after PLAYING holds this long
	var AUTOPLAY_WATCHDOG_MS = 1800; // diagnostic-only window to infer "autoplay blocked"
	var PAUSE_RETRY_LIMIT = 2; // background-loop nudge cap — never an infinite retry loop

	var hero = document.querySelector( '[data-hero]' );
	var mount = document.querySelector( '[data-hero-yt-mount]' );
	var reduceMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	var player = null;
	var iframeEl = null;
	var playerReady = false;
	var playerCreated = false; // guards against double YT.Player() instantiation
	var apiReady = false;
	var domReady = false;

	var stableTimer = null;
	var autoplayWatchdog = null;
	var autoplayConfirmed = false;
	var pauseRetryCount = 0;
	var heroIntersecting = true; // optimistic default so IO setup never blocks first paint

	function log() {
		if ( window.console && window.console.log ) {
			var args = [ '[hero-yt]' ].concat( Array.prototype.slice.call( arguments ) );
			window.console.log.apply( window.console, args );
		}
	}

	/* ---------------------------------------------------------------------
	 * 4. Cover-crop sizing — applied to the Player API's own iframe once it
	 * exists, and re-applied on resize. PC: full-viewport 16:9 cover. SP:
	 * full 100svh frame, landscape source center-cropped left/right.
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
	 * 2. Reveal / hide the whole iframe by confirmed Player State.
	 * --------------------------------------------------------------------- */
	function clearStableTimer() {
		if ( stableTimer !== null ) {
			window.clearTimeout( stableTimer );
			stableTimer = null;
		}
	}

	function showVideoReady() {
		stableTimer = null;
		if ( hero ) {
			hero.setAttribute( 'data-video-ready', '' );
		}
		log( 'iframe revealed (PLAYING stable ' + STABLE_PLAYING_MS + 'ms)' );
	}

	function hideVideo() {
		clearStableTimer();
		if ( hero ) {
			hero.removeAttribute( 'data-video-ready' );
		}
	}

	/* ---------------------------------------------------------------------
	 * 6. Autoplay-blocked diagnostics. The IFrame API has no onAutoplayBlocked
	 * event, so this is inferred: if PLAYING is never reached shortly after
	 * onReady's playVideo() call, treat it as blocked and log it. The
	 * fallback layer is already what's showing (item 8), so nothing else to
	 * do visually.
	 * --------------------------------------------------------------------- */
	function armAutoplayWatchdog() {
		clearAutoplayWatchdog();
		autoplayWatchdog = window.setTimeout( function () {
			autoplayWatchdog = null;
			if ( ! autoplayConfirmed ) {
				log( 'autoplay blocked (no PLAYING within ' + AUTOPLAY_WATCHDOG_MS + 'ms) — fallback stays visible' );
			}
		}, AUTOPLAY_WATCHDOG_MS );
	}

	function clearAutoplayWatchdog() {
		if ( autoplayWatchdog !== null ) {
			window.clearTimeout( autoplayWatchdog );
			autoplayWatchdog = null;
		}
	}

	/* ---------------------------------------------------------------------
	 * Safe (re)play helper — always mute before playVideo, per brief item 3.
	 * Used by onReady, visibilitychange restore, and the IntersectionObserver.
	 * --------------------------------------------------------------------- */
	function safePlay( reason ) {
		if ( ! player || ! playerReady || reduceMotion ) {
			return;
		}
		try {
			player.mute();
			player.setVolume( 0 );
			player.playVideo();
			log( 'playVideo() requested (' + reason + ')' );
		} catch ( err ) {
			log( 'playVideo() threw', err );
		}
	}

	/* ---------------------------------------------------------------------
	 * 7. Player State -> iframe visibility state machine.
	 * --------------------------------------------------------------------- */
	function onPlayerStateChange( event ) {
		if ( ! window.YT ) {
			return;
		}
		var YTState = window.YT.PlayerState;

		switch ( event.data ) {
			case YTState.PLAYING:
				log( 'state: PLAYING' );
				autoplayConfirmed = true;
				clearAutoplayWatchdog();
				pauseRetryCount = 0;
				clearStableTimer();
				stableTimer = window.setTimeout( showVideoReady, STABLE_PLAYING_MS );
				break;

			case YTState.BUFFERING:
				log( 'state: BUFFERING' );
				hideVideo();
				break;

			case YTState.PAUSED:
				log( 'state: PAUSED' );
				hideVideo();
				// Background-loop use case: nudge playback again, capped so a
				// legitimately user/OS-paused state never becomes a retry loop.
				if ( heroIntersecting && pauseRetryCount < PAUSE_RETRY_LIMIT ) {
					pauseRetryCount += 1;
					safePlay( 'resume after PAUSED, retry ' + pauseRetryCount );
				}
				break;

			case YTState.ENDED:
				log( 'state: ENDED' );
				hideVideo();
				// loop:1 + playlist should restart automatically; nothing else to do.
				break;

			case YTState.UNSTARTED:
				log( 'state: UNSTARTED' );
				hideVideo();
				break;

			case YTState.CUED:
				log( 'state: CUED' );
				hideVideo();
				break;

			default:
				break;
		}
	}

	function onPlayerError( event ) {
		// Autoplay blocked / embed failed: keep the fallback, never surface a
		// broken player.
		log( 'onError code:', event && event.data );
		hideVideo();
	}

	/* ---------------------------------------------------------------------
	 * iframe allow attribute — the Player API sets this itself, but confirm
	 * (and repair, defensively) after creation per brief item 2.
	 * --------------------------------------------------------------------- */
	function ensureIframeAllowAttrs() {
		if ( ! iframeEl ) {
			return;
		}
		var required = [ 'autoplay', 'encrypted-media', 'picture-in-picture' ];
		var current = ( iframeEl.getAttribute( 'allow' ) || '' ).split( ';' ).map( function ( s ) {
			return s.trim();
		} ).filter( Boolean );

		required.forEach( function ( token ) {
			if ( current.indexOf( token ) === -1 ) {
				current.push( token );
			}
		} );

		iframeEl.setAttribute( 'allow', current.join( '; ' ) );
		iframeEl.setAttribute( 'playsinline', '1' ); // iOS Safari inline playback, belt-and-suspenders alongside playerVars
		log( 'iframe allow="' + iframeEl.getAttribute( 'allow' ) + '"' );
	}

	function onPlayerReady( event ) {
		playerReady = true;
		iframeEl = event.target.getIframe();
		iframeEl.setAttribute( 'tabindex', '-1' );
		iframeEl.setAttribute( 'aria-hidden', 'true' );
		ensureIframeAllowAttrs();
		sizeHeroVideo();

		log( 'player ready' );

		// Item 3: explicit, in order — mute() and setVolume(0) BEFORE playVideo().
		// Never skipped for "mobile" — mobile is exactly the case this is for.
		event.target.mute();
		event.target.setVolume( 0 );
		event.target.playVideo();
		armAutoplayWatchdog();

		setUpIntersectionObserver();
	}

	/* ---------------------------------------------------------------------
	 * 12. IntersectionObserver — stop/start playback with HERO visibility,
	 * without ever gating the *initial* autoplay attempt on it (onReady
	 * above already fires playVideo() unconditionally).
	 * --------------------------------------------------------------------- */
	function setUpIntersectionObserver() {
		if ( ! hero || ! ( 'IntersectionObserver' in window ) ) {
			return;
		}

		var observer = new window.IntersectionObserver( function ( entries ) {
			entries.forEach( function ( entry ) {
				heroIntersecting = entry.isIntersecting;
				if ( entry.isIntersecting ) {
					log( 'HERO in view' );
					safePlay( 'HERO intersecting' );
				} else {
					log( 'HERO out of view' );
					if ( player && playerReady ) {
						try {
							player.pauseVideo();
						} catch ( err ) { /* no-op */ }
					}
					hideVideo();
				}
			} );
		}, { threshold: 0.15 } );

		observer.observe( hero );
	}

	/* ---------------------------------------------------------------------
	 * 11. visibilitychange — tab switch / lock screen can pause or stall the
	 * embed on mobile Safari/Chrome; retry safely on return.
	 * --------------------------------------------------------------------- */
	function onVisibilityChange() {
		if ( document.visibilityState !== 'visible' ) {
			return;
		}
		if ( ! playerReady || reduceMotion || ! heroIntersecting ) {
			return;
		}
		log( 'document visible again — retrying playback' );
		safePlay( 'visibilitychange restore' );
	}

	/* ---------------------------------------------------------------------
	 * 5. Player creation — exactly once, only once both the IFrame API is
	 * ready AND the DOM mount point exists.
	 * --------------------------------------------------------------------- */
	function createPlayer() {
		if ( playerCreated || ! mount || ! apiReady || ! window.YT || ! window.YT.Player ) {
			return;
		}
		playerCreated = true;

		player = new window.YT.Player( mount, {
			videoId: YT_VIDEO_ID,
			playerVars: {
				autoplay: 1,
				mute: 1,
				playsinline: 1,
				controls: 0,
				loop: 1,
				playlist: YT_VIDEO_ID, // required by the API for loop to work on a single video
				disablekb: 1,
				rel: 0,
				fs: 0,
				modestbranding: 1,
				iv_load_policy: 3
			},
			events: {
				onReady: onPlayerReady,
				onStateChange: onPlayerStateChange,
				onError: onPlayerError
			}
		} );
	}

	function maybeCreatePlayer() {
		if ( domReady && apiReady ) {
			createPlayer();
		}
	}

	function loadYouTubeApi() {
		if ( reduceMotion || ! mount ) {
			// Reduced motion: never request the embed at all — CSS also hides
			// .hero-video under this same media query as a second,
			// independent guard. (Never skipped just because of mobile.)
			return;
		}

		if ( window.YT && window.YT.Player ) {
			apiReady = true;
			maybeCreatePlayer();
			return;
		}

		// Standard YouTube IFrame Player API bootstrap: this global callback
		// name is fixed by the API itself. Chained so a second script on the
		// page that also sets this callback still runs.
		var previousCallback = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = function () {
			if ( typeof previousCallback === 'function' ) {
				previousCallback();
			}
			apiReady = true;
			maybeCreatePlayer();
		};

		var tag = document.createElement( 'script' );
		tag.src = 'https://www.youtube.com/iframe_api';
		var firstScript = document.getElementsByTagName( 'script' )[ 0 ];
		firstScript.parentNode.insertBefore( tag, firstScript );
	}

	function init() {
		domReady = true;
		if ( hero && mount ) {
			window.addEventListener( 'resize', sizeHeroVideo );
			window.addEventListener( 'orientationchange', sizeHeroVideo );
			document.addEventListener( 'visibilitychange', onVisibilityChange );
			loadYouTubeApi();
			maybeCreatePlayer();
		}
	}

	// This script tag sits at the end of <body> (see index.html), so the DOM
	// is already parsed — but guard with DOMContentLoaded too in case that
	// ever changes (defer/async/head placement), so init() still runs
	// exactly once and never races the DOM.
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}

	/* ---------------------------------------------------------------------
	 * 5 (App Bar). App Bar transparent (over HERO) -> dark (scrolled past it).
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
