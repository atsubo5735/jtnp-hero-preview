/**
 * JTNP Area Page — interaction
 *
 * Ported from the behavioural half of the design file's inline script. The
 * review-page machinery in that script is deliberately NOT carried over:
 *
 *   - window.__IMG / data-k Base64 image hydration — a single-file review
 *     technique. Here src/srcset are already real Media Library URLs.
 *   - the variant / view / device segmented controls — the review page renders
 *     three variants and three device frames at once; production renders one.
 *   - hydrate(), which un-parked the first three Instagram posts from a
 *     <template>. Production server-renders them, exactly as the design file's
 *     own comment says it should.
 *
 * What remains is what the page actually needs: the Instagram rail, Show More
 * for posts 4-6, and Show More for ranking places 6-10.
 */
( function () {
	'use strict';

	var root = document.querySelector( '.jtnp-area' );
	if ( ! root ) {
		return;
	}

	/**
	 * Ask Instagram's embed.js to turn any un-processed
	 * blockquote.instagram-media into a real iframe.
	 *
	 * Safe to call repeatedly — it skips the ones already done. embed.js itself
	 * is enqueued once for the whole page (inc/jtnp-area-assets.php); this never
	 * loads it again.
	 */
	function processEmbeds() {
		if ( window.instgrm && window.instgrm.Embeds ) {
			window.instgrm.Embeds.process();
		}
	}

	/* ------------------------------------------------------- Instagram rail */

	/**
	 * Scroll offsets that put each card's leading edge at the rail's edge.
	 *
	 * These are exactly the positions .ig3's scroll-snap-align:start defines, so
	 * scrolling to one of them always lands cleanly on a snap point. Measuring
	 * the cards rather than computing width+gap means the rail adapts between
	 * the tablet (366px) and desktop (380px) card sizes on its own, and cannot
	 * drift out of sync with the CSS through sub-pixel rounding — a step that
	 * lands a fraction short of a snap point is liable to be pulled back by
	 * scroll-snap-type:x mandatory.
	 *
	 * @param {Element} feed The .feed3 rail.
	 * @return {number[]} Ascending scroll offsets, one per card.
	 */
	function cardOffsets( feed ) {
		var origin = feed.getBoundingClientRect().left;
		var current = feed.scrollLeft;

		return Array.prototype.map.call(
			feed.querySelectorAll( '.ig3' ),
			function ( card ) {
				return current + ( card.getBoundingClientRect().left - origin );
			}
		);
	}

	/**
	 * Where the rail would go if moved one card in the given direction.
	 *
	 * Returns null when there is nowhere left to go, which is also exactly the
	 * condition for disabling the corresponding button — refreshRailButtons()
	 * asks this same function, so the control's enabled state and what it
	 * actually does can never disagree.
	 *
	 * Note the start of the rail is NOT scrollLeft 0: .feed3 carries a
	 * horizontal padding of --jtnp-pad so the cards line up with the content
	 * band, and scroll-snap pins the resting start to that padding (32px at
	 * 1440px wide). Testing against a hardcoded 0 would mean the Prev button
	 * never became disabled at the start of the rail.
	 *
	 * @param {Element} feed      The .feed3 rail.
	 * @param {number}  direction -1 for previous, 1 for next.
	 * @return {?number} Target scrollLeft, or null if there is no move to make.
	 */
	function railTarget( feed, direction ) {
		var offsets = cardOffsets( feed );
		if ( ! offsets.length ) {
			return null;
		}

		var here = feed.scrollLeft;
		var max = Math.max( 0, feed.scrollWidth - feed.clientWidth );
		var target = null;
		var i;

		if ( direction > 0 ) {
			for ( i = 0; i < offsets.length; i++ ) {
				if ( offsets[ i ] > here + 1 ) {
					target = offsets[ i ];
					break;
				}
			}
		} else {
			for ( i = offsets.length - 1; i >= 0; i-- ) {
				if ( offsets[ i ] < here - 1 ) {
					target = offsets[ i ];
					break;
				}
			}
		}

		if ( null === target ) {
			return null;
		}

		// Clamp: the trailing cards sit past the maximum scroll offset, so the
		// last press lands flush with the end instead of overshooting.
		target = Math.max( 0, Math.min( target, max ) );

		// After clamping the "next card" may be where we already are.
		if ( direction > 0 && target <= here + 1 ) {
			return null;
		}
		if ( direction < 0 && target >= here - 1 ) {
			return null;
		}

		return target;
	}

	/**
	 * Scroll the rail one card in the given direction.
	 *
	 * Only ever moves .feed3. The Instagram iframe is cross-origin and its
	 * internal carousel is never touched — a hard requirement of the embed spec.
	 *
	 * @param {Element} feed      The .feed3 rail.
	 * @param {number}  direction -1 for previous, 1 for next.
	 */
	function railScroll( feed, direction ) {
		var target = railTarget( feed, direction );
		if ( null === target ) {
			return;
		}

		feed.scrollTo( { left: target, behavior: 'smooth' } );

		/*
		 * 'scrollend' is the precise signal, but Safari only gained it in 17.4.
		 * This re-check covers older browsers; where scrollend does fire the
		 * state has simply already settled and this is a no-op.
		 */
		window.setTimeout( function () {
			refreshRailButtons( feed );
		}, 600 );
	}

	/**
	 * Enable/disable the rail controls at each end of the scroll range.
	 *
	 * @param {Element} feed The .feed3 rail.
	 */
	function refreshRailButtons( feed ) {
		var section = feed.closest( '.igsec' );
		if ( ! section ) {
			return;
		}
		var ctrl = section.querySelector( '.igctrl' );
		if ( ! ctrl ) {
			return;
		}
		var prev = ctrl.querySelector( '.igprev' );
		var next = ctrl.querySelector( '.ignext' );

		if ( prev ) {
			prev.disabled = ( null === railTarget( feed, -1 ) );
		}
		if ( next ) {
			next.disabled = ( null === railTarget( feed, 1 ) );
		}
	}

	Array.prototype.forEach.call( root.querySelectorAll( '.igsec' ), function ( section ) {
		var feed = section.querySelector( '.feed3' );
		var prev = section.querySelector( '.igprev' );
		var next = section.querySelector( '.ignext' );

		if ( ! feed || ! prev || ! next ) {
			return;
		}

		prev.addEventListener( 'click', function () {
			railScroll( feed, -1 );
		} );

		next.addEventListener( 'click', function () {
			railScroll( feed, 1 );
		} );

		feed.addEventListener( 'scroll', function () {
			refreshRailButtons( feed );
		}, { passive: true } );

		// Fires once the smooth animation and any snap correction have settled.
		feed.addEventListener( 'scrollend', function () {
			refreshRailButtons( feed );
		} );

		/*
		 * The rail only exists at >= 576px; below that .feed3 is a vertical
		 * stack and the controls are display:none. Re-evaluating on resize
		 * keeps the disabled state honest when a viewport crosses that
		 * boundary, and when Instagram's own script resizes the embeds after
		 * hydration.
		 */
		window.addEventListener( 'resize', function () {
			refreshRailButtons( feed );
		}, { passive: true } );

		refreshRailButtons( feed );
	} );

	/* ------------------------------------------- Instagram Show More (4-6) */

	/*
	 * Posts 4-6 live inside <template class="more3src"> until this button is
	 * pressed: they are not in the DOM, so none of their markup, images or
	 * iframes is fetched on initial load.
	 */
	Array.prototype.forEach.call( root.querySelectorAll( '.more3' ), function ( btn ) {
		btn.addEventListener( 'click', function () {
			var section = btn.closest( '.igsec' );
			if ( ! section ) {
				return;
			}
			var feed = section.querySelector( '.feed3' );
			var tpl = section.querySelector( '.more3src' );
			if ( ! feed || ! tpl ) {
				return;
			}

			var countBefore = feed.querySelectorAll( '.ig3' ).length;

			feed.appendChild( tpl.content.cloneNode( true ) );
			btn.hidden = true;

			processEmbeds();
			refreshRailButtons( feed );

			/*
			 * On Tablet/Desktop (a horizontal rail) bring the first newly
			 * revealed post into view. inline:'start' + block:'nearest' only
			 * ever scrolls the nearest scrollable ancestor on that axis — i.e.
			 * .feed3 itself, never the page.
			 *
			 * On Mobile the posts form a vertical stack and simply extend the
			 * page in the direction it already scrolls, so no scroll is needed.
			 * The rail is detected by asking whether .feed3 is actually
			 * horizontally scrollable rather than by sniffing the viewport,
			 * which keeps this in step with the CSS breakpoint automatically.
			 */
			var isRail = feed.scrollWidth > feed.clientWidth + 1;
			if ( isRail ) {
				var cards = feed.querySelectorAll( '.ig3' );
				var target = cards[ countBefore ];
				if ( target ) {
					target.scrollIntoView( {
						behavior: 'smooth',
						inline: 'start',
						block: 'nearest'
					} );
				}
			}
		} );
	} );

	/* ------------------------------------------------- Ranking Show More */

	/*
	 * Places 6-10 work the same way, and the control only exists in the DOM at
	 * all when there are entries to reveal — see template-parts/jtnp/ranking.php.
	 * The control is a toggle: clicking it while collapsed reveals places
	 * 6-10 and relabels the button "閉じる"; clicking it again while expanded
	 * hides them again and restores the original "もっと見る" label, without
	 * re-cloning the <template> a second time.
	 */
	Array.prototype.forEach.call( root.querySelectorAll( '.more10' ), function ( btn ) {
		var section = btn.closest( '.sec-ranking' );
		if ( ! section ) {
			return;
		}
		var list = section.querySelector( '.ranks' );
		var tpl = section.querySelector( '.more10src' );
		if ( ! list || ! tpl ) {
			return;
		}

		var labelMore = btn.getAttribute( 'data-label-more' ) || btn.textContent;
		var labelClose = btn.getAttribute( 'data-label-close' ) || labelMore;
		var label = btn.querySelector( '.more10-label' );
		var revealedNodes = null;
		if ( ! label ) {
			return;
		}

		btn.addEventListener( 'click', function () {
			var expanded = 'true' === btn.getAttribute( 'aria-expanded' );

			if ( ! expanded ) {
				if ( ! revealedNodes ) {
					var fragment = tpl.content.cloneNode( true );
					revealedNodes = Array.prototype.slice.call( fragment.children );
					list.appendChild( fragment );
				} else {
					revealedNodes.forEach( function ( node ) {
						node.hidden = false;
					} );
				}

				btn.setAttribute( 'aria-expanded', 'true' );
				label.textContent = labelClose;

				// Expansion happens in place — no page navigation, per the spec.
				var first = revealedNodes[ 0 ];
				if ( first && typeof first.focus === 'function' ) {
					first.setAttribute( 'tabindex', '-1' );
					first.focus( { preventScroll: true } );
				}
			} else {
				revealedNodes.forEach( function ( node ) {
					node.hidden = true;
				} );

				btn.setAttribute( 'aria-expanded', 'false' );
				label.textContent = labelMore;
			}
		} );
	} );

	/*
	 * Instagram sizes its iframes from its own script once it has loaded. If it
	 * finishes after this file has run, the rail's scrollWidth changes and the
	 * Prev/Next disabled state would be stale, so re-check once the window load
	 * event has fired.
	 */
	window.addEventListener( 'load', function () {
		Array.prototype.forEach.call( root.querySelectorAll( '.feed3' ), refreshRailButtons );
	} );
}() );
