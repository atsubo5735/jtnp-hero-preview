/**
 * JTNP HOME prototype — HERO YouTube DIAGNOSTIC build
 * -----------------------------------------------------------------------
 * TEMPORARY, PROTOTYPE-DIAGNOSTIC-ONLY SCRIPT. Not part of the WordPress
 * theme. Not the production hero.js. Loaded ONLY by this standalone
 * preview's index.html, in place of assets/js/hero.js, for as long as we
 * need to see real Player State / event data on an actual iPhone/Android
 * handset where DevTools is not available.
 *
 * This is assets/js/hero.js with two kinds of change layered on top —
 * nothing about the YouTube embed method itself (IFrame Player API,
 * autoplay/mute/playsinline/loop strategy) is altered:
 *
 *   A. A small fixed on-screen panel (bottom-left of the HERO) plus
 *      matching console.log lines, reporting — live, updated on every
 *      relevant event — exactly the facts we need from a handset that
 *      has no attached DevTools:
 *        API, PLAYER, PLAY REQUEST, AUTOPLAY BLOCKED, STATE, ERROR,
 *        VISIBILITY, HERO IN VIEW, REDUCED MOTION.
 *      This is diagnostic-only chrome: it is NOT part of the visitor-
 *      facing design and carries the bare minimum styling.
 *
 *   B. The official `onAutoplayBlocked` IFrame Player API event is wired
 *      up (players created after ~April 2021 support it) alongside the
 *      existing onReady/onStateChange/onError — so "autoplay blocked" is
 *      reported from the API's own signal, not only inferred from a
 *      watchdog timer (the watchdog is kept too, only as a fallback for
 *      older embeds/browsers that never fire it).
 *
 *      Also, ONLY for this diagnostic build: the state-driven
 *      opacity/hide of the iframe (assets/css/hero-override.css's
 *      [data-video-ready] gating, meant to hide YouTube's own initial
 *      play/pause/UI flash from visitors) is left disabled — the iframe
 *      is revealed as soon as the player exists, regardless of state —
 *      specifically so we can SEE whether/why YouTube's native play
 *      button or other chrome is appearing on the handset. HERO layout/
 *      crop (size, position, cover-crop math) is completely unchanged.
 */
( function () {
	'use strict';

	var YT_VIDEO_ID = 'wGupxN7yHWI';
	var STABLE_PLAYING_MS = 400; // brief item 7: iframe only shown after PLAYING holds this long
	var AUTOPLAY_WATCHDOG_MS = 1800; // fallback-only window to infer "autoplay blocked" if the official event never fires
	var PAUSE_RETRY_LIMIT = 2; // background-loop nudge cap — never an infinite retry loop

	// Diagnostic-only: never hide the iframe by Player State in this build,
	// so YouTube's own on-screen UI (if any) stays visible to inspect. HERO
	// layout/crop is untouched — this only affects the [data-video-ready]
	// opacity swap between the fallback poster and the real iframe.
	var DIAG_FORCE_VIDEO_VISIBLE = true;

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
			var args = [ '[hero-yt-diag]' ].concat( Array.prototype.slice.call( arguments ) );
			window.console.log.apply( window.console, args );
		}
	}

	/* =======================================================================
	 * DIAGNOSTIC PANEL — temporary, prototype-only. Not visitor-facing UI.
	 * ===================================================================== */
	var diag = {
		api: 'LOADING',           // LOADING / READY / FAILED
		player: 'LOADING',        // LOADING / READY
		playRequest: 'NO',        // YES once playVideo() has been called
		autoplayBlocked: 'NO',    // YES/NO
		state: 'UNKNOWN',         // UNSTARTED / ENDED / PLAYING / PAUSED / BUFFERING / CUED
		error: 'none',            // none / <YouTube error code>
		visibility: document.visibilityState || 'unknown',
		heroInView: 'yes',
		reducedMotion: reduceMotion ? 'true' : 'false'
	};

	var diagPanelEl = null;
	var diagRowEls = {};

	function buildDiagPanel() {
		if ( ! hero || diagPanelEl ) {
			return;
		}

		var panel = document.createElement( 'div' );
		panel.setAttribute( 'data-hero-yt-diag-panel', '' );
		panel.style.cssText = [
			'position:absolute',
			'left:8px',
			'bottom:8px',
			'z-index:9999',
			'max-width:78vw',
			'padding:6px 8px',
			'background:rgba(0,0,0,.72)',
			'color:#7CFC9A',
			'font:9px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
			'letter-spacing:.02em',
			'white-space:pre',
			'border:1px solid rgba(124,252,154,.35)',
			'border-radius:4px',
			'pointer-events:none',
			'user-select:none'
		].join( ';' );

		var title = document.createElement( 'div' );
		title.textContent = 'YT DIAGNOSTIC';
		title.style.cssText = 'color:#fff;font-weight:700;margin-bottom:2px;';
		panel.appendChild( title );

		var rows = [
			[ 'api', 'API' ],
			[ 'player', 'PLAYER' ],
			[ 'playRequest', 'PLAY REQUEST' ],
			[ 'autoplayBlocked', 'AUTOPLAY BLOCKED' ],
			[ 'state', 'STATE' ],
			[ 'error', 'ERROR' ],
			[ 'visibility', 'VISIBILITY' ],
			[ 'heroInView', 'HERO IN VIEW' ],
			[ 'reducedMotion', 'REDUCED MOTION' ]
		];

		rows.forEach( function ( pair ) {
			var key = pair[ 0 ];
			var label = pair[ 1 ];
			var row = document.createElement( 'div' );
			row.textContent = label + ': ' + diag[ key ];
			panel.appendChild( row );
			diagRowEls[ key ] = { el: row, label: label };
		} );

		hero.appendChild( panel );
		diagPanelEl = panel;
	}

	function updateDiag( patch ) {
		var changed = [];
		Object.keys( patch ).forEach( function ( key ) {
			if ( diag[ key ] !== patch[ key ] ) {
				diag[ key ] = patch[ key ];
				changed.push( key );
			}
		} );

		if ( ! diagRowEls || ! changed.length ) {
			return;
		}
		changed.forEach( function ( key ) {
			var row = diagRowEls[ key ];
			if ( row ) {
				row.el.textContent = row.label + ': ' + diag[ key ];
			}
		} );

		log( 'DIAGNOSTIC', JSON.stringify( diag ) );
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
	 *
	 * DIAGNOSTIC BUILD ONLY: when DIAG_FORCE_VIDEO_VISIBLE is true, the
	 * iframe is revealed as soon as the player exists and never hidden
	 * again by state — so YouTube's own native UI, if it appears, is
	 * visible to inspect on the handset. Production hero.js is unaffected.
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
		if ( DIAG_FORCE_VIDEO_VISIBLE ) {
			// Diagnostic mode: never hide — leave the iframe (and whatever
			// YouTube is drawing inside it) visible regardless of state.
			return;
		}
		if ( hero ) {
			hero.removeAttribute( 'data-video-ready' );
		}
	}

	/* ---------------------------------------------------------------------
	 * 6. Autoplay-blocked diagnostics. The IFrame Player API now exposes an
	 * official `onAutoplayBlocked` event (wired below, in createPlayer) —
	 * that is the primary signal. This watchdog is kept only as a fallback
	 * for older embeds/browsers where that event never fires, so
	 * AUTOPLAY BLOCKED still gets reported either way.
	 * --------------------------------------------------------------------- */
	function armAutoplayWatchdog() {
		clearAutoplayWatchdog();
		autoplayWatchdog = window.setTimeout( function () {
			autoplayWatchdog = null;
			if ( ! autoplayConfirmed ) {
				log( 'watchdog: autoplay likely blocked (no PLAYING within ' + AUTOPLAY_WATCHDOG_MS + 'ms)' );
				updateDiag( { autoplayBlocked: 'YES' } );
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
	 * Official onAutoplayBlocked handler — fires when the browser refused
	 * the autoplay attempt (distinct from onError). Authoritative over the
	 * watchdog above whenever it does fire.
	 * --------------------------------------------------------------------- */
	function onPlayerAutoplayBlocked( event ) {
		log( 'onAutoplayBlocked (official event)', event );
		clearAutoplayWatchdog();
		updateDiag( { autoplayBlocked: 'YES' } );
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
			updateDiag( { playRequest: 'YES' } );
		} catch ( err ) {
			log( 'playVideo() threw', err );
		}
	}

	/* ---------------------------------------------------------------------
	 * 7. Player State -> iframe visibility state machine (diagnostic build:
	 * visibility toggling is short-circuited by DIAG_FORCE_VIDEO_VISIBLE
	 * inside hideVideo(); the panel/console STATE field is always updated).
	 * --------------------------------------------------------------------- */
	var STATE_NAMES = {
		'-1': 'UNSTARTED',
		'0': 'ENDED',
		'1': 'PLAYING',
		'2': 'PAUSED',
		'3': 'BUFFERING',
		'5': 'CUED'
	};

	function onPlayerStateChange( event ) {
		if ( ! window.YT ) {
			return;
		}
		var YTState = window.YT.PlayerState;
		var stateName = STATE_NAMES[ String( event.data ) ] || ( 'UNKNOWN(' + event.data + ')' );

		log( 'state:', stateName );
		updateDiag( { state: stateName } );

		switch ( event.data ) {
			case YTState.PLAYING:
				autoplayConfirmed = true;
				clearAutoplayWatchdog();
				updateDiag( { autoplayBlocked: 'NO' } );
				pauseRetryCount = 0;
				clearStableTimer();
				stableTimer = window.setTimeout( showVideoReady, STABLE_PLAYING_MS );
				break;

			case YTState.BUFFERING:
				hideVideo();
				break;

			case YTState.PAUSED:
				hideVideo();
				// Background-loop use case: nudge playback again, capped so a
				// legitimately user/OS-paused state never becomes a retry loop.
				if ( heroIntersecting && pauseRetryCount < PAUSE_RETRY_LIMIT ) {
					pauseRetryCount += 1;
					safePlay( 'resume after PAUSED, retry ' + pauseRetryCount );
				}
				break;

			case YTState.ENDED:
				hideVideo();
				// loop:1 + playlist should restart automatically; nothing else to do.
				break;

			case YTState.UNSTARTED:
				hideVideo();
				break;

			case YTState.CUED:
				hideVideo();
				break;

			default:
				break;
		}
	}

	function onPlayerError( event ) {
		// Autoplay blocked / embed failed: keep the fallback, never surface a
		// broken player.
		var code = event && event.data;
		log( 'onError code:', code );
		updateDiag( { error: String( code ) } );
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
		updateDiag( { player: 'READY' } );

		if ( DIAG_FORCE_VIDEO_VISIBLE && hero ) {
			// Reveal immediately so YouTube's own on-screen UI (play button,
			// title bar, etc.), if it appears, is visible from the very first
			// frame — this is exactly what we're trying to observe.
			hero.setAttribute( 'data-video-ready', '' );
		}

		// Item 3: explicit, in order — mute() and setVolume(0) BEFORE playVideo().
		// Never skipped for "mobile" — mobile is exactly the case this is for.
		event.target.mute();
		event.target.setVolume( 0 );
		event.target.playVideo();
		log( 'playVideo() requested (onReady)' );
		updateDiag( { playRequest: 'YES' } );
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
				updateDiag( { heroInView: entry.isIntersecting ? 'yes' : 'no' } );
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
		updateDiag( { visibility: document.visibilityState } );
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
				onError: onPlayerError,
				onAutoplayBlocked: onPlayerAutoplayBlocked // official IFrame API event
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
			log( 'reduced motion or no mount — embed not requested' );
			return;
		}

		if ( window.YT && window.YT.Player ) {
			apiReady = true;
			updateDiag( { api: 'READY' } );
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
			log( 'onYouTubeIframeAPIReady fired' );
			apiReady = true;
			updateDiag( { api: 'READY' } );
			maybeCreatePlayer();
		};

		var tag = document.createElement( 'script' );
		tag.src = 'https://www.youtube.com/iframe_api';
		tag.onerror = function () {
			log( 'iframe_api script failed to load' );
			updateDiag( { api: 'FAILED' } );
		};
		var firstScript = document.getElementsByTagName( 'script' )[ 0 ];
		firstScript.parentNode.insertBefore( tag, firstScript );
	}

	function init() {
		domReady = true;
		buildDiagPanel();
		if ( hero && mount ) {
			window.addEventListener( 'resize', sizeHeroVideo );
			window.addEventListener( 'orientationchange', sizeHeroVideo );
			document.addEventListener( 'visibilitychange', onVisibilityChange );
			loadYouTubeApi();
			maybeCreatePlayer();
		} else {
			log( 'hero or mount element missing — diagnostic cannot attach' );
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
	 * Unchanged from production hero.js — kept only so this diagnostic page
	 * still renders/behaves like the real prototype while we inspect it.
	 * --------------------------------------------------------------------- */
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
