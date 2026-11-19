// Zona horaria fija para que las pruebas de fechas den lo mismo en cualquier máquina o CI.
module.exports = async () => { process.env.TZ = 'America/Mexico_City'; };
