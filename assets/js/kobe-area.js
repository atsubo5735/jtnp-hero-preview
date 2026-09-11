/**
 * KOBE prototype — Influencer (Instagram Official Embed) rail controls.
 *
 * Mirrors the confirmed production behaviour documented in
 * template-parts/jtnp/influencer.php: Prev/Next scroll the .feed3 rail
 * only (never the embedded iframe itself); "もっと見る" moves posts 4-6
 * out of <template> and into the rail, then re-runs
 * window.instgrm.Embeds.process() so Instagram's embed.js renders them.
 *
 * Standalone, KOBE-page-only script — does not touch ../assets/js/hero.js
 * or any other HOME prototype file.
 */
( function () {
	'use strict';

	var feed = document.getElementById( 'jtnp-ig-feed' );
	var moreBtn = document.getElementById( 'jtnp-ig-more' );
	var moreSrc = document.getElementById( 'jtnp-ig-more-src' );
	var prevBtn = document.querySelector( '.igprev' );
	var nextBtn = document.querySelector( '.ignext' );

	function processEmbeds() {
		if ( window.instgrm && window.instgrm.Embeds ) {
			window.instgrm.Embeds.process();
		}
	}

	if ( moreBtn && moreSrc && feed ) {
		moreBtn.addEventListener( 'click', function () {
			feed.appendChild( moreSrc.content.cloneNode( true ) );
			moreBtn.parentNode.removeChild( moreBtn );
			processEmbeds();
		} );
	}

	function scrollRail( dir ) {
		if ( ! feed ) {
			return;
		}
		var card = feed.querySelector( '.ig3' );
		var step = card ? card.getBoundingClientRect().width + 16 : 340;
		feed.scrollBy( { left: dir * step, behavior: 'smooth' } );
	}

	if ( prevBtn ) {
		prevBtn.addEventListener( 'click', function () {
			scrollRail( -1 );
		} );
	}
	if ( nextBtn ) {
		nextBtn.addEventListener( 'click', function () {
			scrollRail( 1 );
		} );
	}

	// embed.js loads async (kobe/index.html) and may not have defined
	// window.instgrm yet at DOMContentLoaded — process once it is ready.
	if ( window.instgrm && window.instgrm.Embeds ) {
		processEmbeds();
	} else {
		window.addEventListener( 'load', processEmbeds );
	}
}() );
