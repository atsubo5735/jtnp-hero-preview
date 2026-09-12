/**
 * KOBE prototype — HERO background + App Bar over-HERO behaviour.
 *
 * TEMPORARY presentation-meeting swap: the background is currently driven
 * by the YouTube IFrame Player API (same technique as the HOME HERO's own
 * assets/js/hero.js), not the HTML5 MP4 <video> this file used to drive.
 * The MP4 markup (assets/video/kobe-hero.mp4) is kept in kobe/index.html,
 * commented out, for the future WordPress/MP4 implementation — see this
 * file's own history for the previous <video>-driven version.
 *
 * Standalone prototype script. Does not touch, require or load
 * ../assets/js/hero.js (the HOME YouTube HERO's own script) — the two HERO
 * implementations are completely independent instances (own DOM ids, own
 * video id, own player object), reusing the same pattern, not the same
 * code/state.
 *
 * Responsibilities:
 *   1. Load the YouTube IFrame Player API and create the background player
 *      muted/looped/controls-hidden/playsinline, same mobile-autoplay-safe
 *      sequence as HOME's hero.js (mute() + setVolume(0) before
 *      playVideo()). Player is created exactly once.
 *   2. Keep the real player at opacity:0 (CSS, kobe-hero-override.css) and
 *      the fallback layer on top until playback is CONFIRMED stable
 *      (PlayerState.PLAYING held for ~500ms) — same PLAYING-state-driven
 *      reveal as HOME, so YouTube's own initial play/pause/scrub UI flash
 *      never reaches the visitor.
 *   3. If autoplay is blocked or the embed fails, the fallback simply stays
 *      visible — HERO text/App Bar are never affected.
 *   4. Cover-crop the 16:9 player against the HERO frame, centered.
 *   5. IntersectionObserver — pause/resume playback with HERO visibility.
 *   6. App Bar: transparent while over the HERO, the theme's own existing
 *      dark gradient (kobe-hero-override.css) once scrolled past it — same
 *      technique as ../assets/js/hero.js uses for HOME, reimplemented here
 *      independently since that file is HOME-only.
 */
( function () {
	'use strict';

	var YT_VIDEO_ID = 'wGupxN7yHWI'; // temporary presentation-meeting swap (was HOME's previous id)
	var STABLE_PLAYING_MS = 500;
	var AUTOPLAY_WATCHDOG_MS = 1800;
	var PAUSE_RETRY_LIMIT = 2;

	var hero = document.querySelector( '.jtnp-kobe-hero-blk .hero' );
	var mount = document.getElementById( 'jtnp-kobe-hero-yt' );
	var reduceMotion = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	var player = null;
	var iframeEl = null;
	var playerReady = false;
	var playerCreated = false;
	var apiReady = false;
	var domReady = false;

	var stableTimer = null;
	var autoplayWatchdog = null;
	var autoplayConfirmed = false;
	var pauseRetryCount = 0;
	var heroIntersecting = true;

	function log() {
		if ( window.console && window.console.log ) {
			var args = [ '[kobe-hero-yt]' ].concat( Array.prototype.slice.call( arguments ) );
			window.console.log.apply( window.console, args );
		}
	}

	/* --------------------------------------------------------------------
	 * Cover-crop sizing, applied to the Player API's own iframe.
	 * -------------------------------------------------------------------- */
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

	/* --------------------------------------------------------------------
	 * Reveal / hide the whole iframe by confirmed Player State.
	 * -------------------------------------------------------------------- */
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

	/* --------------------------------------------------------------------
	 * Player State -> iframe visibility state machine.
	 * -------------------------------------------------------------------- */
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
				if ( heroIntersecting && pauseRetryCount < PAUSE_RETRY_LIMIT ) {
					pauseRetryCount += 1;
					safePlay( 'resume after PAUSED, retry ' + pauseRetryCount );
				}
				break;

			case YTState.ENDED:
				log( 'state: ENDED' );
				hideVideo();
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
		log( 'onError code:', event && event.data );
		hideVideo();
	}

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
		iframeEl.setAttribute( 'playsinline', '1' );
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

		event.target.mute();
		event.target.setVolume( 0 );
		event.target.playVideo();
		armAutoplayWatchdog();

		setUpIntersectionObserver();
	}

	/* --------------------------------------------------------------------
	 * IntersectionObserver — stop/start playback with HERO visibility.
	 * -------------------------------------------------------------------- */
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

	/* --------------------------------------------------------------------
	 * visibilitychange — tab switch / lock screen can pause or stall the
	 * embed on mobile Safari/Chrome; retry safely on return.
	 * -------------------------------------------------------------------- */
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

	/* --------------------------------------------------------------------
	 * Player creation — exactly once, only once both the IFrame API is
	 * ready AND the DOM mount point exists.
	 * -------------------------------------------------------------------- */
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
			return;
		}

		if ( window.YT && window.YT.Player ) {
			apiReady = true;
			maybeCreatePlayer();
			return;
		}

		// Standard YouTube IFrame Player API bootstrap. Chained so a second
		// script on the page (HOME's own hero.js is a different page/load,
		// but defensively chained the same way) still runs if this callback
		// was already set.
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

	function initVideo() {
		domReady = true;
		if ( hero && mount ) {
			window.addEventListener( 'resize', sizeHeroVideo );
			window.addEventListener( 'orientationchange', sizeHeroVideo );
			document.addEventListener( 'visibilitychange', onVisibilityChange );
			loadYouTubeApi();
			maybeCreatePlayer();
		}
	}

	if ( reduceMotion ) {
		// Reduced motion: never request the embed; the fallback stays as the
		// permanent background (kobe-hero-override.css also hides
		// .hero-video under this same media query as a second, independent
		// guard).
	} else if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initVideo );
	} else {
		initVideo();
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
