function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método no permitido.' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!resendKey || !supabaseUrl || !supabaseKey) {
    return json(res, 500, { error: 'Faltan variables de entorno en Vercel.' });
  }

  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    return json(res, 401, { error: 'Sesión no válida.' });
  }

  const token = authorization.slice(7);
  const authResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseKey,
    },
  });

  if (!authResponse.ok) {
    return json(res, 401, { error: 'No se pudo validar la sesión.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { to, employeeName, videoTitle, statusName, targetDate, assignedBy, appUrl } = body;

  if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
    return json(res, 400, { error: 'El integrante no tiene un email válido.' });
  }

  const safeName = escapeHtml(employeeName || 'Integrante del equipo');
  const safeTitle = escapeHtml(videoTitle || 'Video sin título');
  const safeStatus = escapeHtml(statusName || 'Sin estado');
  const safeAssignedBy = escapeHtml(assignedBy || 'Fútbol XL Studio');
  const safeUrl = /^https?:\/\//i.test(appUrl || '') ? appUrl : '';
  const dateText = targetDate
    ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${targetDate}T00:00:00Z`))
    : 'Sin fecha definida';

  const from = process.env.EMAIL_FROM || 'Fútbol XL Studio <onboarding@resend.dev>';
  const html = `
    <div style="margin:0;background:#0b0b0c;padding:32px 16px;font-family:Arial,sans-serif;color:#f5f5f5">
      <div style="max-width:580px;margin:auto;background:#18181b;border:1px solid #303036;border-radius:16px;overflow:hidden">
        <div style="padding:26px 28px;border-bottom:1px solid #303036">
          <div style="font-size:13px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.08em">Fútbol XL Studio</div>
          <h1 style="font-size:24px;margin:10px 0 0">Nuevo proyecto asignado</h1>
        </div>
        <div style="padding:28px">
          <p style="margin-top:0">Hola <strong>${safeName}</strong>,</p>
          <p style="color:#d4d4d8">Se te asignó un proyecto en Fútbol XL Studio.</p>
          <div style="background:#101012;border:1px solid #303036;border-radius:12px;padding:18px;margin:24px 0">
            <div style="color:#a1a1aa;font-size:12px;text-transform:uppercase">Video</div>
            <div style="font-size:18px;font-weight:700;margin:6px 0 18px">${safeTitle}</div>
            <div style="color:#a1a1aa;font-size:12px;text-transform:uppercase">Estado</div>
            <div style="margin:6px 0 18px">${safeStatus}</div>
            <div style="color:#a1a1aa;font-size:12px;text-transform:uppercase">Fecha objetivo</div>
            <div style="margin-top:6px">${escapeHtml(dateText)}</div>
          </div>
          ${safeUrl ? `<a href="${escapeHtml(safeUrl)}" style="display:inline-block;background:#3b82f6;color:white;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:9px">Abrir Fútbol XL Studio</a>` : ''}
          <p style="font-size:12px;color:#71717a;margin:26px 0 0">Asignado por ${safeAssignedBy}.</p>
        </div>
      </div>
    </div>`;

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `🎬 Nuevo proyecto asignado: ${videoTitle || 'Video sin título'}`,
      html,
    }),
  });

  const resendData = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    console.error('[Resend]', resendData);
    return json(res, resendResponse.status, { error: resendData.message || 'Resend rechazó el envío.' });
  }

  return json(res, 200, { ok: true, id: resendData.id });
};
