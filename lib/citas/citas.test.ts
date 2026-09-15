import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { citasAgrupadasPorDia, citasDelDia, direccionDeInmueble, enlaceGoogleMaps, horaCita, horaDesdeMinutos, minutosDesdeHora, minutosDesdeOffsetY, moverCitaADiaHora, moverSemana, puedeHacerParte, portadaDeMedia, prefillParteDesdeCita, relacionUno, rutaNuevaCita, rutaNuevaVisitaDesdeCita, semanaDesde, snapMinutos } from "./citas";

describe("citas", () => {
  it("el parte se abre prellenado desde la cita, no al revés", () => {
    const cita = {
      id: "c1",
      titulo: "Visita Oleiros",
      empieza: "2026-09-17T18:00:00.000Z",
      propiedadId: "p1",
    };
    assert.equal(rutaNuevaVisitaDesdeCita(cita), "/partes-visita?nueva=1&cita=c1&propiedad=p1");
    const prefill = prefillParteDesdeCita(cita);
    assert.equal(prefill.propiedadId, "p1");
    assert.equal(prefill.fechaVisita, "2026-09-17");
    assert.equal(prefill.observaciones, "Visita Oleiros");
    assert.equal(rutaNuevaCita({ propiedadId: "p1", clienteId: "c1" }), "/calendario?propiedad=p1&cliente=c1");
  });

  it("agrupa citas del día y calcula semana lunes-domingo", () => {
    const semana = semanaDesde("2026-09-16");
    assert.equal(semana[0], "2026-09-14");
    assert.equal(semana[6], "2026-09-20");
    const delDia = citasDelDia(
      [
        { id: "a", empieza: "2026-09-16T09:00:00.000Z" },
        { id: "b", empieza: "2026-09-16T18:00:00.000Z" },
        { id: "c", empieza: "2026-09-17T10:00:00.000Z" },
      ],
      "2026-09-16"
    );
    assert.deepEqual(
      delDia.map((item) => item.id),
      ["a", "b"]
    );
  });

  it("normaliza el join de perfil aunque Supabase lo devuelva en array", () => {
    assert.deepEqual(relacionUno({ color: "#123" }), { color: "#123" });
    assert.deepEqual(relacionUno([{ color: "#abc" }]), { color: "#abc" });
    assert.equal(relacionUno(null), null);
  });

  it("arma la semana en columnas y mueve de semana en semana", () => {
    const semana = semanaDesde("2026-09-16");
    const mapa = citasAgrupadasPorDia(
      [
        { id: "a", empieza: "2026-09-14T09:00:00.000Z" },
        { id: "b", empieza: "2026-09-16T18:00:00.000Z" },
      ],
      semana
    );
    assert.equal(mapa.get("2026-09-14")?.length, 1);
    assert.equal(mapa.get("2026-09-16")?.[0]?.id, "b");
    assert.equal(moverSemana("2026-09-16", 1), "2026-09-23");
    assert.equal(horaCita("2026-09-16T18:00:00"), "18:00");
    assert.equal(puedeHacerParte({ tipo: "visita", estado: "prevista" }), true);
    assert.equal(puedeHacerParte({ tipo: "llamada", estado: "prevista" }), false);
    assert.equal(puedeHacerParte({ tipo: "visita", estado: "hecha" }), false);
  });

  it("arrastra una cita a otro día y hora en saltos de 15 minutos", () => {
    assert.equal(snapMinutos(10 * 60 + 7), 10 * 60);
    assert.equal(snapMinutos(10 * 60 + 8), 10 * 60 + 15);
    assert.equal(minutosDesdeOffsetY(48, 48, 9), 10 * 60);
    const movida = moverCitaADiaHora({
      empieza: "2026-09-16T09:00:00",
      termina: "2026-09-16T10:00:00",
      dia: "2026-09-18",
      minutos: 11 * 60 + 7,
    });
    assert.equal(movida.vence, "2026-09-18");
    assert.equal(movida.hora, "11:00");
    const start = new Date(movida.empieza);
    const end = new Date(movida.termina);
    assert.equal(start.getHours(), 11);
    assert.equal(end.getHours(), 12);
    assert.equal(minutosDesdeHora("18:30"), 18 * 60 + 30);
    assert.equal(horaDesdeMinutos(11 * 60 + 7), "11:00");
  });

  it("arma el enlace de Google Maps y la dirección del inmueble", () => {
    assert.equal(direccionDeInmueble({ direccion: "Rúa Nova 12", localidad: "Oleiros" }), "Rúa Nova 12, Oleiros");
    assert.equal(
      enlaceGoogleMaps({ consulta: "Rúa Nova 12, Oleiros" }),
      "https://www.google.com/maps/search/?api=1&query=R%C3%BAa%20Nova%2012%2C%20Oleiros"
    );
    assert.equal(enlaceGoogleMaps({ lat: 43.33, lng: -8.31 }), "https://www.google.com/maps/search/?api=1&query=43.33,-8.31");
    assert.equal(enlaceGoogleMaps({}), null);
    assert.equal(
      portadaDeMedia([
        { url: "b.jpg", portada: false, tipo: "foto" },
        { url: "a.jpg", portada: true, tipo: "foto" },
      ]),
      "a.jpg"
    );
  });
});
