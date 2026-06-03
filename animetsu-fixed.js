async function searchResults(keyword) {
    const results = [];
    const headers = {
        'Referer': 'https://animetsu.net/',
        'Origin': 'https://animetsu.net',
        'User-Agent': 'Mozilla/5.0'
    };

    const encodedKeyword = encodeURIComponent(keyword);

    const response = await fetchv2(
        `https://animetsu.net/v2/api/anime/search/?query=${encodedKeyword}`,
        headers
    );

    const json = await response.json();

    if (json?.results) {
        json.results.forEach(anime => {
            const title =
                anime.title?.english ||
                anime.title?.romaji ||
                anime.title?.native ||
                "Unknown Title";

            const image = anime.cover_image?.large || "";
            const href = `${anime.id}`;

            results.push({
                title,
                image,
                href
            });
        });
    }

    return JSON.stringify(results);
}

async function extractDetails(id) {
    const headers = {
        'Referer': 'https://animetsu.net/',
        'Origin': 'https://animetsu.net',
        'User-Agent': 'Mozilla/5.0'
    };

    const response = await fetchv2(
        `https://animetsu.net/v2/api/anime/info/${id}`,
        headers
    );

    const json = await response.json();

    const results = [{
        description: cleanHtmlSymbols(json.description || "No description available"),
        aliases: json.synonyms?.join(', ') || 'N/A',
        airdate: json.start_date || 'N/A'
    }];

    return JSON.stringify(results);
}

async function extractEpisodes(id) {
    const headers = {
        'Referer': 'https://animetsu.net/',
        'Origin': 'https://animetsu.net',
        'User-Agent': 'Mozilla/5.0'
    };

    const response = await fetchv2(
        `https://animetsu.net/v2/api/anime/eps/${id}`,
        headers
    );

    const json = await response.json();

    const results = [];

    for (const ep of json) {
        results.push({
            number: ep.ep_num,
            href: `?id=${id}&num=${ep.ep_num}`
        });
    }

    return JSON.stringify(results);
}

async function extractStreamUrl(slug) {
    const headers = {
        'Referer': 'https://animetsu.net/',
        'Origin': 'https://animetsu.net',
        'User-Agent': 'Mozilla/5.0'
    };

    const id = (slug.match(/[?&]id=([^&]+)/) || [])[1];
    const num = (slug.match(/[?&]num=([^&]+)/) || [])[1];

    const streams = [];

    try {
        const serverListRes = await fetchv2(
            `https://animetsu.net/v2/api/anime/servers/${id}/${num}`,
            headers
        );

        const serverList = await serverListRes.json();

        for (const server of serverList) {
            for (const subType of ['sub', 'dub']) {
                try {
                    const url =
                        `https://animetsu.net/v2/api/anime/oppai/${id}/${num}` +
                        `?server=${server.id}&source_type=${subType}`;

                    const res = await fetchv2(url, headers);
                    const data = await res.json();

                    if (data?.sources?.length) {
                        for (const source of data.sources) {
                            let streamUrl =
                                source.url.startsWith('http')
                                    ? source.url
                                    : `https://swiftstream.top/proxy${source.url}`;

                            let quality = source.quality || 'Auto';

                            if (
                                server.id === 'kite' &&
                                quality.toLowerCase() === 'master'
                            ) {
                                quality = '1080p';
                            }

                            streams.push({
                                title: `${server.id} - ${quality} - ${subType.toUpperCase()}`,
                                streamUrl: streamUrl,
                                url: streamUrl,
                                downloadUrl: streamUrl,
                                type: "hls",
                                headers: {
                                    'Referer': 'https://animetsu.net/',
                                    'Origin': 'https://animetsu.net',
                                    'User-Agent': 'Mozilla/5.0'
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.error(
                        `Error fetching ${server.id} (${subType}):`,
                        e
                    );
                }
            }
        }
    } catch (e) {
        console.error("Error fetching server list:", e);
    }

    const serverOrder = {
        pahe: 1,
        meg: 2,
        kite: 3
    };

    const qualityOrder = q => {
        q = q.toLowerCase();
        if (q.includes('1080')) return 1;
        if (q.includes('720')) return 2;
        if (q.includes('480')) return 3;
        if (q.includes('360')) return 4;
        return 5;
    };

    streams.sort((a, b) => {
        const aParts = a.title.split(' - ');
        const bParts = b.title.split(' - ');

        const aServer = serverOrder[aParts[0].toLowerCase()] || 99;
        const bServer = serverOrder[bParts[0].toLowerCase()] || 99;

        const aQuality = qualityOrder(aParts[1]);
        const bQuality = qualityOrder(bParts[1]);

        if (aQuality !== bQuality) {
            return aQuality - bQuality;
        }

        return aServer - bServer;
    });

    const finalStreams = streams.map((s, index) => ({
        ...s,
        title: `[Server ${index + 1}] ${s.title}`
    }));

    return JSON.stringify({
        streams: finalStreams,
        subtitle: ""
    });
}

function cleanHtmlSymbols(string) {
    if (!string) return "";

    return string
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, "-")
        .replace(/&#[0-9]+;/g, "")
        .replace(/\r?\n|\r/g, " ")
        .replace(/\s+/g, " ")
        .replace(/<i[^>]*>(.*?)<\/i>/g, "$1")
        .replace(/<b[^>]*>(.*?)<\/b>/g, "$1")
        .replace(/<[^>]+>/g, "")
        .trim();
}
