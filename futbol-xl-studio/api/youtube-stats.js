function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey || !channelId) {
    return sendJson(res, 500, {
      error: 'Faltan YOUTUBE_API_KEY o YOUTUBE_CHANNEL_ID en Vercel.',
    });
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: channelId,
      key: apiKey,
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      console.error('[YouTube API]', data);
      return sendJson(res, response.status, {
        error: data?.error?.message || 'YouTube rechazó la consulta.',
      });
    }

    const channel = data.items?.[0];
    if (!channel) {
      return sendJson(res, 404, { error: 'No se encontró el canal configurado.' });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return sendJson(res, 200, {
      title: channel.snippet?.title || 'Fútbol XL',
      thumbnail:
        channel.snippet?.thumbnails?.medium?.url ||
        channel.snippet?.thumbnails?.default?.url ||
        '',
      subscribers: Number(channel.statistics?.subscriberCount || 0),
      views: Number(channel.statistics?.viewCount || 0),
      videos: Number(channel.statistics?.videoCount || 0),
      hiddenSubscribers: Boolean(channel.statistics?.hiddenSubscriberCount),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[YouTube Stats]', error);
    return sendJson(res, 500, { error: 'No se pudieron recuperar las estadísticas de YouTube.' });
  }
};
