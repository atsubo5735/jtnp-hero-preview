/**
 * JTNP Explore Japan MAP — static CMS-shaped seed for this standalone prototype
 * -----------------------------------------------------------------------
 * Not part of the WordPress theme. In production this exact shape is
 * localized server-side by inc/jtnp-area-assets.php from published
 * jtnp_map_area posts (inc/jtnp-map-areas.php::jtnp_map_area_frontend_data()).
 * There is no WordPress/CMS running in this static prototype, so the values
 * below are ported verbatim from the Source of Truth ZIP's own one-time seed
 * data (inc/jtnp-map-areas-seed.php's jtnp_map_area_seed_v1_data() — the
 * SAME 6 areas, coordinates, image slugs and statuses already confirmed
 * in production) rather than inventing new content.
 *
 * assets/js/jtnp-explore-map.js merges this over window.JTNP_MAP
 * (assets/js/jtnp-map-data.js, untouched static SVG geometry) at runtime —
 * see that file's own initExplore() comment.
 */
window.JTNP_MAP_AREAS_CMS = ( function () {
	'use strict';

	// Prefecture JP name (JTNP_MAP.prefs[].n) -> display label. In production
	// jtnp_prefectures()'s 'label' is this same full prefecture name for
	// every one of the 47 entries, so an identity map here reproduces that
	// exactly for every prefecture the MAP can render, not only the 6 with a
	// seeded Area.
	var prefNames = [
		'北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県',
		'埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県',
		'岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
		'鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県',
		'佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'
	];
	var prefLabels = {};
	var prefShortLabels = {};
	prefNames.forEach( function ( n ) {
		prefLabels[ n ] = n;
		// Short labels: drop the trailing 都/道/府/県 suffix, matching
		// jtnp_prefectures()'s own short_label convention.
		prefShortLabels[ n ] = n.replace( /[都道府県]$/, '' );
	} );

	var regionLabels = {
		'北海道': '北海道',
		'東北': '東北',
		'関東': '関東',
		'中部': '中部',
		'近畿': '近畿',
		'中国': '中国',
		'四国': '四国',
		'九州・沖縄': '九州・沖縄'
	};

	// Only 兵庫県 (KOBE) is 'on' — every other prefecture is 'off', matching
	// the seed's pre-CMS statuses (every non-KOBE area was 'coming_soon' and
	// no other prefecture had any seeded area at all).
	var prefStatus = {};
	prefNames.forEach( function ( n ) {
		prefStatus[ n ] = ( '兵庫県' === n ) ? 'on' : 'off';
	} );

	// Areas: prefecture JP name -> ordered list of {jp,x,y,slug,rank}. x/y are
	// copied verbatim from jtnp-map-areas-seed.php (== the original
	// JTNP_MAP.areas[...] coordinates).
	var areas = {
		'東京都': [
			{ jp: '浅草', x: 336.4, y: 405.8, slug: 'asakusa', rank: 2 }
		],
		'神奈川県': [
			{ jp: '横浜みなとみらい', x: 331.2, y: 416.2, slug: 'yokohama-minatomirai', rank: 1 },
			{ jp: '馬車道', x: 331.7, y: 416.7, slug: 'bashamichi', rank: 2 }
		],
		'京都府': [
			{ jp: '清水寺', x: 199.5, y: 424, slug: 'kiyomizu', rank: 1 }
		],
		'大阪府': [
			{ jp: '大阪城', x: 201.8, y: 446.9, slug: 'osaka-castle', rank: 1 }
		],
		'兵庫県': [
			{ jp: '神戸ポートタワー', x: 191.1, y: 447.1, slug: 'kobe', rank: 1 }
		]
	};

	// Area slug -> {url,status,imageUrl}. 'kobe' alone resolves to a real
	// (prototype) Area link; the other 5 have no Area Page yet in production
	// either (jtnp_map_area_seed_resolve_page_id() returns 0 for them), so
	// their url stays '' — jtnp_link_open()'s existing inert-<span> fallback.
	var meta = {
		'asakusa': { url: '', status: 'coming_soon', imageUrl: 'assets/images/content/spoon-asakusa.png' },
		'yokohama-minatomirai': { url: '', status: 'coming_soon', imageUrl: 'assets/images/content/spoon-yokohama-minatomirai.png' },
		'bashamichi': { url: '', status: 'coming_soon', imageUrl: 'assets/images/content/spoon-bashamichi.png' },
		'kiyomizu': { url: '', status: 'coming_soon', imageUrl: 'assets/images/content/spoon-kiyomizu.png' },
		'osaka-castle': { url: '', status: 'coming_soon', imageUrl: 'assets/images/content/spoon-osaka-castle.png' },
		'kobe': { url: 'kobe-area-preview.html', status: 'active', imageUrl: 'assets/images/content/spoon-kobe.png' }
	};

	var strings = {
		preparing: '準備中',
		otherCount: 'ほか%s',
		areaCount: '%sエリア',
		areaCountSpaced: '%s エリア',
		prefectureAreaCount: '%1$s、%2$s',
		comingSoon: '近日公開',
		comingSoonParenthetical: '（近日）',
		japan: '日本全国',
		japanBreadcrumb: '日本全国 ＞ %s'
	};

	return {
		areas: areas,
		prefStatus: prefStatus,
		prefLabels: prefLabels,
		prefShortLabels: prefShortLabels,
		regionLabels: regionLabels,
		strings: strings
	};
}() );

window.JTNP_AREA_META = ( function () {
	var meta = {};
	var cms = window.JTNP_MAP_AREAS_CMS;
	// jtnp-explore-map.js reads window.JTNP_AREA_META directly (separate
	// global from JTNP_MAP_AREAS_CMS, matching inc/jtnp-area-assets.php's own
	// two separate wp_localize_script() calls) — duplicated here from the
	// object above rather than re-declared, so there is exactly one source
	// for these 6 rows.
	return {
		'asakusa': { url: '', status: 'coming_soon', imageUrl: 'assets/images/content/spoon-asakusa.png' },
		'yokohama-minatomirai': { url: '', status: 'coming_soon', imageUrl: 'assets/images/content/spoon-yokohama-minatomirai.png' },
		'bashamichi': { url: '', status: 'coming_soon', imageUrl: 'assets/images/content/spoon-bashamichi.png' },
		'kiyomizu': { url: '', status: 'coming_soon', imageUrl: 'assets/images/content/spoon-kiyomizu.png' },
		'osaka-castle': { url: '', status: 'coming_soon', imageUrl: 'assets/images/content/spoon-osaka-castle.png' },
		'kobe': { url: 'kobe-area-preview.html', status: 'active', imageUrl: 'assets/images/content/spoon-kobe.png' }
	};
}() );
