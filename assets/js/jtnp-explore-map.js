/**
 * JTNP Global Component — Explore Japan (MAP / Prefecture Selector)
 *
 * Shared, unmodified, by the national top (front-page.php) and every JTNP
 * Area Page (page-jtnp-area.php) — loaded whenever either page renders
 * template-parts/jtnp/explore.php (#jtnp-explore), gated in
 * inc/jtnp-area-assets.php rather than a page-specific file, so it is not a
 * "national top only" script that happens to also load elsewhere. Depends on
 * window.JTNP_MAP (assets/js/jtnp-map-data.js, static geometry/content ported
 * verbatim from the design file) and window.JTNP_AREA_META (localized from
 * inc/jtnp-global-data.php::jtnp_explore_area_meta(), the real URL/status/
 * image per area — identical on every page, since every prefecture/area in
 * the MAP is the same regardless of which JTNP page is showing it).
 *
 * The MAP interaction is adapted from design/JTNP_JapanTOP_HiFi_ja.html's own
 * prototype script (that file is this project's confirmed source for the
 * MAP's behaviour) — same state machine (S0 japan / S1 prefecture / S2 area
 * preview), same zoom/spread math — rewired for a single live section
 * instead of a 3-frame width-comparison strip, and for real Area Page links
 * instead of an in-page preview only.
 *
 * Before 0.7.1 this lived inside assets/js/jtnp-national.js (national-top-only)
 * and only ran there — extracted verbatim (no logic changed, only $root's
 * starting point) so a JTNP Area Page can render the exact same MAP without a
 * second copy of this script.
 */
( function () {
	'use strict';

	var root = document.getElementById( 'jtnp-explore' );
	if ( ! root ) {
		return;
	}

	var RM = window.matchMedia( '(prefers-reduced-motion: reduce)' );
	var SVGNS = 'http://www.w3.org/2000/svg';

	function el( tag, cls, attrs ) {
		var node = document.createElementNS( SVGNS, tag );
		if ( cls ) {
			node.setAttribute( 'class', cls );
		}
		if ( attrs ) {
			for ( var key in attrs ) {
				if ( Object.prototype.hasOwnProperty.call( attrs, key ) ) {
					node.setAttribute( key, attrs[ key ] );
				}
			}
		}
		return node;
	}

	/* -------------------------------------------------------- Explore/MAP */

	function initExplore() {
		var JP = window.JTNP_MAP;
		var META = window.JTNP_AREA_META || {};
		var CMS = window.JTNP_MAP_AREAS_CMS || {};
		var STRINGS = CMS.strings || {};
		var wrap = root.querySelector( '[data-jtnp-mapwrap]' );
		if ( ! JP || ! wrap ) {
			return;
		}

		/*
		 * CMS Source of Truth (SNS-EXPLORE-MAP-CMS-1) — merged over the static
		 * JTNP_MAP geometry rather than edited into it: assets/js/jtnp-map-data.js
		 * stays the untouched SVG geometry file (47 prefecture paths, viewBox,
		 * bounding boxes — this project's brief keeps that file code-only), and
		 * window.JTNP_MAP_AREAS_CMS (localized by inc/jtnp-area-assets.php from
		 * published jtnp_map_area posts, inc/jtnp-map-areas.php) supplies the
		 * two pieces of content this MAP used to hardcode on top of that
		 * geometry: JP.areas (previously a fixed object keyed by prefecture
		 * name) and each prefecture's 'on'/'soon'/'off' state (previously
		 * JP.prefs[].st, a fixed flag — now the CMS-aggregated status of that
		 * prefecture's own areas, see jtnp_map_area_aggregate_prefecture_status()).
		 * Every other JP field (.d/.bb/.cx/.cy/.n/.s/.r/.slug, .vb, .oki_inset,
		 * .hi, .regions) is read as-is below, unmodified.
		 */
		// Current-language display copy localized from PHP/gettext. The object
		// keys bridge to the immutable static geometry's JP.prefs[].n / .r data;
		// those lookup names are never used as visitor-facing fallbacks.
		var PREF_LABELS = CMS.prefLabels || {};
		var PREF_SHORT_LABELS = CMS.prefShortLabels || {};
		var REGION_LABELS = CMS.regionLabels || {};
		function string( key ) {
			return 'string' === typeof STRINGS[ key ] ? STRINGS[ key ] : '';
		}
		function format( template ) {
			var values = Array.prototype.slice.call( arguments, 1 );
			var next = 0;
			return template.replace( /%(\d+\$)?s/g, function ( match, position ) {
				var index = position ? parseInt( position, 10 ) - 1 : next++;
				return index >= 0 && index < values.length ? String( values[ index ] ) : '';
			} );
		}
		function prefLabel( name ) {
			return PREF_LABELS[ name ] || '';
		}
		function prefShortLabel( name ) {
			return PREF_SHORT_LABELS[ name ] || '';
		}
		function regionLabel( name ) {
			return REGION_LABELS[ name ] || '';
		}

		if ( window.JTNP_MAP_AREAS_CMS ) {
			JP = Object.create( JP );
			JP.areas = window.JTNP_MAP_AREAS_CMS.areas || {};
			var prefStatus = window.JTNP_MAP_AREAS_CMS.prefStatus || {};
			JP.prefs = JP.prefs.map( function ( p ) {
				var merged = Object.create( p );
				merged.st = prefStatus[ p.n ] || 'off';
				return merged;
			} );
		}

		var svg = wrap.querySelector( '[data-jtnp-map]' );
		var pinLayer = wrap.querySelector( '[data-jtnp-pins]' );
		var stage = wrap.querySelector( '.mapstage' );

		svg.setAttribute( 'viewBox', JP.vb.join( ' ' ) );
		svg.setAttribute( 'preserveAspectRatio', 'xMidYMid meet' );

		var gLand = el( 'g' );
		var gLead = el( 'g' );
		svg.appendChild( gLand );
		svg.appendChild( gLead );

		var oki = JP.oki_inset;
		gLand.appendChild( el( 'rect', null, {
			x: oki[ 0 ], y: oki[ 1 ], width: oki[ 2 ], height: oki[ 3 ],
			fill: 'none', stroke: 'rgba(255,255,255,.18)', 'stroke-dasharray': '5 4', rx: 4
		} ) );

		// Pin offsets (moved off-land so labels don't collide with dense
		// coastline) and their lead-line anchor back to the true centroid —
		// ported verbatim from the design's own PINOFF/LEAD constants.
		var PINOFF = { '東京都': [ 374, 364 ], '神奈川県': [ 356, 468 ], '大阪府': [ 238, 486 ], '兵庫県': [ 148, 380 ], '京都府': [ 252, 400 ] };
		var LEAD = { '東京都': [ 328, 404 ], '神奈川県': [ 324, 420 ], '大阪府': [ 204, 452 ], '兵庫県': [ 178, 418 ], '京都府': [ 203, 422 ] };

		function representative( prefName ) {
			var areas = JP.areas[ prefName ] || [];
			if ( ! areas.length ) {
				return string( 'preparing' );
			}
			if ( 1 === areas.length ) {
				return areas[ 0 ].jp;
			}
			return areas[ 0 ].jp + ' ' + format( string( 'otherCount' ), areas.length - 1 );
		}

		var paths = {};
		JP.prefs.forEach( function ( p ) {
			var attrs = { d: p.d, 'stroke-width': 0.9, 'vector-effect': 'non-scaling-stroke' };
			if ( 'on' === p.st ) {
				attrs.fill = 'rgba(223,180,60,.22)';
				attrs.stroke = 'rgba(242,208,107,.85)';
			} else if ( 'soon' === p.st ) {
				attrs.fill = 'rgba(53,198,198,.05)';
				attrs.stroke = 'rgba(53,198,198,.55)';
				attrs[ 'stroke-dasharray' ] = '4 3';
			} else {
				attrs.fill = 'rgba(255,255,255,.035)';
				attrs.stroke = 'rgba(255,255,255,.12)';
			}
			var node = el( 'path', 'pf ' + p.st, attrs );
			node.setAttribute( 'aria-hidden', 'true' );
			paths[ p.n ] = node;
			gLand.appendChild( node );
			if ( 'on' === p.st ) {
				node.addEventListener( 'click', function () {
					selectPref( p.n );
				} );
			}
		} );

		function proj() {
			var r = svg.getBoundingClientRect();
			var vb = svg.getAttribute( 'viewBox' ).split( ' ' ).map( Number );
			var s = Math.min( r.width / vb[ 2 ], r.height / vb[ 3 ] );
			return { s: s, ox: ( r.width - vb[ 2 ] * s ) / 2 - vb[ 0 ] * s, oy: ( r.height - vb[ 3 ] * s ) / 2 - vb[ 1 ] * s };
		}

		var pins = [];
		function layout() {
			var p = proj();
			pins.forEach( function ( q ) {
				q.node.style.left = ( p.ox + q.x * p.s ) + 'px';
				q.node.style.top = ( p.oy + q.y * p.s ) + 'px';
			} );
		}

		function mkPin( cls, label, sub, x, y, onClick, aria ) {
			var b = document.createElement( 'button' );
			b.type = 'button';
			b.className = 'mpin ' + cls;
			var isArea = cls.indexOf( 'ar' ) !== -1;
			b.innerHTML = '<span class="nm"></span><span class="dot">' + ( sub && isArea ? sub : '' ) + '</span>' +
				( sub && ! isArea ? '<span class="sub"></span>' : '' );
			b.querySelector( '.nm' ).textContent = label;
			var subEl = b.querySelector( '.sub' );
			if ( subEl ) {
				subEl.textContent = sub;
			}
			if ( aria ) {
				b.setAttribute( 'aria-label', aria );
			}
			if ( onClick ) {
				b.addEventListener( 'click', onClick );
			} else {
				b.tabIndex = -1;
			}
			pinLayer.appendChild( b );
			pins.push( { node: b, x: x, y: y } );
			return b;
		}

		function drawJapanPins() {
			pinLayer.innerHTML = '';
			pins = [];
			while ( gLead.firstChild ) {
				gLead.removeChild( gLead.firstChild );
			}
			JP.prefs.filter( function ( p ) {
				return 'off' !== p.st;
			} ).forEach( function ( p ) {
				var off = PINOFF[ p.n ] || [ p.cx, p.cy ];
				if ( LEAD[ p.n ] ) {
					gLead.appendChild( el( 'line', null, {
						x1: off[ 0 ], y1: off[ 1 ], x2: LEAD[ p.n ][ 0 ], y2: LEAD[ p.n ][ 1 ],
						stroke: 'rgba(223,180,60,.45)', 'stroke-width': 0.9, 'vector-effect': 'non-scaling-stroke'
					} ) );
				}
				var count = ( JP.areas[ p.n ] || [] ).length;
				if ( 'on' === p.st ) {
					mkPin( '', prefLabel( p.n ), representative( p.n ), off[ 0 ], off[ 1 ], function () {
						selectPref( p.n );
					}, format( string( 'prefectureAreaCount' ), prefLabel( p.n ), format( string( 'areaCount' ), count ) ) );
				} else {
					mkPin( 'soon', prefLabel( p.n ), string( 'comingSoon' ), off[ 0 ], off[ 1 ], null );
				}
			} );
			layout();
		}

		/* ---------------------------------------------------- Selector UI */

		var rail = root.querySelector( '[data-jtnp-rail]' );
		JP.prefs.filter( function ( p ) {
			return 'on' === p.st;
		} ).forEach( function ( p ) {
			var b = document.createElement( 'button' );
			b.type = 'button';
			b.className = 'pchip';
			b.dataset.p = p.n;
			var count = ( JP.areas[ p.n ] || [] ).length;
			b.innerHTML = '<span></span><small></small>';
			b.firstElementChild.textContent = prefLabel( p.n );
			b.lastElementChild.textContent = format( string( 'areaCountSpaced' ), count );
			b.addEventListener( 'click', function () {
				selectPref( p.n );
			} );
			rail.appendChild( b );
		} );
		JP.prefs.filter( function ( p ) {
			return 'soon' === p.st;
		} ).forEach( function ( p ) {
			var b = document.createElement( 'span' );
			b.className = 'pchip soon';
			b.innerHTML = '<span></span><small></small>';
			b.firstElementChild.textContent = prefLabel( p.n );
			b.lastElementChild.textContent = string( 'comingSoon' );
			rail.appendChild( b );
		} );

		var reglist = root.querySelector( '[data-jtnp-reglist]' );
		JP.regions.forEach( function ( r ) {
			var d = document.createElement( 'div' );
			d.className = 'reg';
			var s = document.createElement( 'span' );
			s.textContent = regionLabel( r );
			d.appendChild( s );
			var row = document.createElement( 'div' );
			row.className = 'prow';
			JP.prefs.filter( function ( p ) {
				return p.r === r;
			} ).forEach( function ( p ) {
				var b;
				if ( 'on' === p.st ) {
					b = document.createElement( 'button' );
					b.type = 'button';
					b.className = 'ptag on';
					b.dataset.p = p.n;
					var count = ( JP.areas[ p.n ] || [] ).length;
					b.innerHTML = '<span></span><b></b>';
					b.firstElementChild.textContent = prefLabel( p.n );
					b.lastElementChild.textContent = count;
					b.addEventListener( 'click', function () {
						selectPref( p.n );
					} );
				} else if ( 'soon' === p.st ) {
					b = document.createElement( 'span' );
					b.className = 'ptag soon';
					b.textContent = prefLabel( p.n ) + string( 'comingSoonParenthetical' );
				} else {
					b = document.createElement( 'span' );
					b.className = 'ptag';
					b.textContent = prefShortLabel( p.n );
				}
				row.appendChild( b );
			} );
			d.appendChild( row );
			reglist.appendChild( d );
		} );

		var acc = root.querySelector( '[data-jtnp-acc]' );
		var accToggle = root.querySelector( '[data-jtnp-acc-toggle]' );
		function toggleAcc() {
			var open = acc.classList.toggle( 'open' );
			accToggle.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
		}
		accToggle.addEventListener( 'click', toggleAcc );
		accToggle.addEventListener( 'keydown', function ( e ) {
			if ( 'Enter' === e.key || ' ' === e.key ) {
				e.preventDefault();
				toggleAcc();
			}
		} );

		/* --------------------------------------------------------- state */

		var s0 = root.querySelector( '[data-jtnp-s0]' );
		var s1 = root.querySelector( '[data-jtnp-s1]' );
		var acards = root.querySelector( '[data-jtnp-acards]' );
		var empty = root.querySelector( '[data-jtnp-empty]' );
		var prev = root.querySelector( '[data-jtnp-prev]' );
		var backBtn = root.querySelector( '[data-jtnp-back]' );
		var crumb = root.querySelector( '[data-jtnp-crumb]' );
		var cur = null;
		var anim = null;

		function fitBox( bb, aspect, pad ) {
			var x = bb[ 0 ], y = bb[ 1 ], w = bb[ 2 ], h = bb[ 3 ];
			var cx = x + w / 2, cy = y + h / 2;
			w *= ( 1 + pad );
			h *= ( 1 + pad );
			if ( w / h < aspect ) {
				w = h * aspect;
			} else {
				h = w / aspect;
			}
			return [ cx - w / 2, cy - h / 2, w, h ];
		}

		function animVB( target, onFrame ) {
			var from = svg.getAttribute( 'viewBox' ).split( ' ' ).map( Number );
			if ( anim ) {
				cancelAnimationFrame( anim );
			}
			if ( RM.matches ) {
				svg.setAttribute( 'viewBox', target.join( ' ' ) );
				if ( onFrame ) {
					onFrame();
				}
				return;
			}
			var t0 = performance.now();
			var duration = 280;
			function ease( t ) {
				return 1 - Math.pow( 1 - t, 3 );
			}
			function step( t ) {
				var k = Math.min( 1, ( t - t0 ) / duration );
				var e = ease( k );
				svg.setAttribute( 'viewBox', from.map( function ( v, i ) {
					return v + ( target[ i ] - v ) * e;
				} ).join( ' ' ) );
				if ( onFrame ) {
					onFrame();
				}
				if ( k < 1 ) {
					anim = requestAnimationFrame( step );
				}
			}
			anim = requestAnimationFrame( step );
		}

		function spread( pts, minD ) {
			var out = pts.map( function ( p ) {
				return [ p[ 0 ], p[ 1 ] ];
			} );
			for ( var it = 0; it < 40; it++ ) {
				var moved = false;
				for ( var i = 0; i < out.length; i++ ) {
					for ( var j = i + 1; j < out.length; j++ ) {
						var dx = out[ j ][ 0 ] - out[ i ][ 0 ];
						var dy = out[ j ][ 1 ] - out[ i ][ 1 ];
						var d = Math.hypot( dx, dy );
						if ( d < minD ) {
							if ( d < 1e-6 ) {
								dx = 0;
								dy = -1;
								d = 1;
							}
							var push = ( minD - d ) / 2;
							out[ i ][ 0 ] -= dx / d * push;
							out[ i ][ 1 ] -= dy / d * push;
							out[ j ][ 0 ] += dx / d * push;
							out[ j ][ 1 ] += dy / d * push;
							moved = true;
						}
					}
				}
				if ( ! moved ) {
					break;
				}
			}
			return out;
		}

		function areaMeta( area ) {
			return META[ area.slug ] || { url: '', status: 'soon', imageUrl: '' };
		}

		function selectPref( name ) {
			var p = null;
			for ( var i = 0; i < JP.prefs.length; i++ ) {
				if ( JP.prefs[ i ].n === name ) {
					p = JP.prefs[ i ];
					break;
				}
			}
			if ( ! p ) {
				return;
			}
			cur = name;
			var areas = JP.areas[ name ] || [];
			wrap.dataset.st = 'pref';
			crumb.textContent = format( string( 'japanBreadcrumb' ), prefLabel( name ) );

			JP.prefs.forEach( function ( q ) {
				var node = paths[ q.n ];
				if ( q.n === name ) {
					node.setAttribute( 'fill', 'rgba(223,180,60,.32)' );
					node.setAttribute( 'stroke', '#F2D06B' );
					node.setAttribute( 'd', JP.hi[ q.n ] || q.d );
					node.removeAttribute( 'opacity' );
				} else {
					node.setAttribute( 'opacity', '.30' );
				}
			} );

			while ( gLead.firstChild ) {
				gLead.removeChild( gLead.firstChild );
			}
			pinLayer.innerHTML = '';
			pins = [];

			var r = svg.getBoundingClientRect();
			var target = fitBox( p.bb, r.width / r.height, 0.75 );
			var sc = Math.min( r.width / target[ 2 ], r.height / target[ 3 ] );
			var pos = spread( areas.map( function ( a ) {
				return [ a.x, a.y ];
			} ), 74 / sc );

			areas.forEach( function ( a, i ) {
				if ( Math.hypot( pos[ i ][ 0 ] - a.x, pos[ i ][ 1 ] - a.y ) > 0.3 ) {
					gLead.appendChild( el( 'line', null, {
						x1: pos[ i ][ 0 ], y1: pos[ i ][ 1 ], x2: a.x, y2: a.y,
						stroke: 'rgba(223,180,60,.55)', 'stroke-width': 0.9, 'vector-effect': 'non-scaling-stroke'
					} ) );
				}
				mkPin( 'ar', a.jp, String( a.rank || i + 1 ), pos[ i ][ 0 ], pos[ i ][ 1 ], function () {
					openPrev( i );
				}, a.jp );
			} );
			animVB( target, layout );

			s0.hidden = true;
			s1.hidden = false;
			prev.classList.remove( 'show' );
			root.querySelector( '[data-jtnp-s1name]' ).textContent = prefLabel( name );
			root.querySelector( '[data-jtnp-s1cnt]' ).textContent = areas.length ? format( string( 'areaCountSpaced' ), areas.length ) : string( 'preparing' );
			acards.innerHTML = '';
			empty.hidden = areas.length > 0;

			areas.forEach( function ( a, i ) {
				var meta = areaMeta( a );
				var d = document.createElement( 'div' );
				d.className = 'acard';
				d.tabIndex = 0;
				d.innerHTML = '<span class="no"></span><div class="ph"></div><div class="nm"></div><span class="ar">›</span>';
				d.querySelector( '.no' ).textContent = String( a.rank || i + 1 );
				var nm = d.querySelector( '.nm' );
				nm.textContent = a.jp;
				if ( meta.imageUrl ) {
					d.querySelector( '.ph' ).style.backgroundImage = 'url(' + meta.imageUrl + ')';
				}
				d.addEventListener( 'click', function () {
					openPrev( i );
				} );
				d.addEventListener( 'keydown', function ( e ) {
					if ( 'Enter' === e.key ) {
						e.preventDefault();
						openPrev( i );
					}
				} );
				acards.appendChild( d );
			} );

			root.querySelectorAll( '.pchip, .ptag.on' ).forEach( function ( n ) {
				n.classList.toggle( 'sel', n.dataset.p === name );
			} );
		}

		function openPrev( i ) {
			var areas = ( cur && JP.areas[ cur ] ) || [];
			var a = areas[ i ];
			if ( ! a ) {
				return;
			}
			var meta = areaMeta( a );

			prev.classList.add( 'show' );
			root.querySelector( '[data-jtnp-prevjp]' ).textContent = a.jp;
			root.querySelector( '[data-jtnp-preven]' ).textContent = prefLabel( cur );

			var photo = root.querySelector( '[data-jtnp-prevphoto]' );
			photo.style.backgroundImage = meta.imageUrl ? 'url(' + meta.imageUrl + ')' : '';

			var link = root.querySelector( '[data-jtnp-prevlink]' );
			if ( meta.url ) {
				link.href = meta.url;
				link.classList.remove( 'disabled' );
				link.removeAttribute( 'aria-disabled' );
			} else {
				link.removeAttribute( 'href' );
				link.classList.add( 'disabled' );
				link.setAttribute( 'aria-disabled', 'true' );
			}

			acards.querySelectorAll( '.acard' ).forEach( function ( n, k ) {
				n.classList.toggle( 'sel', k === i );
			} );
			pinLayer.querySelectorAll( '.mpin.ar' ).forEach( function ( n, k ) {
				n.classList.toggle( 'sel', k === i );
			} );
		}

		var prevClose = root.querySelector( '[data-jtnp-prevclose]' );
		function closePrev() {
			prev.classList.remove( 'show' );
			acards.querySelectorAll( '.acard' ).forEach( function ( n ) {
				n.classList.remove( 'sel' );
			} );
			pinLayer.querySelectorAll( '.mpin.ar' ).forEach( function ( n ) {
				n.classList.remove( 'sel' );
			} );
		}
		prevClose.addEventListener( 'click', closePrev );
		prevClose.addEventListener( 'keydown', function ( e ) {
			if ( 'Enter' === e.key || ' ' === e.key ) {
				e.preventDefault();
				closePrev();
			}
		} );

		function reset() {
			cur = null;
			wrap.dataset.st = 'japan';
			crumb.textContent = string( 'japan' );
			JP.prefs.forEach( function ( q ) {
				var node = paths[ q.n ];
				node.removeAttribute( 'opacity' );
				node.setAttribute( 'd', q.d );
				if ( 'on' === q.st ) {
					node.setAttribute( 'fill', 'rgba(223,180,60,.22)' );
					node.setAttribute( 'stroke', 'rgba(242,208,107,.85)' );
				}
			} );
			drawJapanPins();
			animVB( JP.vb.slice(), layout );
			s0.hidden = false;
			s1.hidden = true;
			prev.classList.remove( 'show' );
			root.querySelectorAll( '.pchip, .ptag.on' ).forEach( function ( n ) {
				n.classList.remove( 'sel' );
			} );
		}
		backBtn.addEventListener( 'click', reset );
		wrap.addEventListener( 'keydown', function ( e ) {
			if ( 'Escape' === e.key && cur ) {
				reset();
			}
		} );

		drawJapanPins();
		new ResizeObserver( layout ).observe( stage );
	}

	initExplore();
}() );
