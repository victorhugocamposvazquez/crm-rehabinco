export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          role: string;
          nombre_completo: string | null;
          telefono: string | null;
          foto_url: string | null;
          color: string;
          zona: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          role?: string;
          nombre_completo?: string | null;
          telefono?: string | null;
          foto_url?: string | null;
          color?: string;
          zona?: string | null;
          activo?: boolean;
        };
        Update: {
          email?: string | null;
          role?: string;
          nombre_completo?: string | null;
          telefono?: string | null;
          foto_url?: string | null;
          color?: string;
          zona?: string | null;
          activo?: boolean;
          updated_at?: string;
        };
      };
      clientes: {
        Row: {
          id: string;
          user_id: string;
          nombre: string;
          email: string | null;
          telefono: string | null;
          tipo_cliente: "particular" | "empresa";
          cliente_padre_id: string | null;
          documento_fiscal: string | null;
          tipo_documento: "dni" | "nie" | "cif" | "vat" | null;
          direccion: string | null;
          codigo_postal: string | null;
          localidad: string | null;
          notas: string | null;
          activo: boolean;
          etiqueta: "fallecido" | null;
          presupuesto_logo_url: string | null;
          presupuesto_cabecera_url: string | null;
          plantilla_presupuesto: "deportivo" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          nombre: string;
          email?: string | null;
          telefono?: string | null;
          tipo_cliente?: "particular" | "empresa";
          cliente_padre_id?: string | null;
          documento_fiscal?: string | null;
          tipo_documento?: "dni" | "nie" | "cif" | "vat" | null;
          direccion?: string | null;
          codigo_postal?: string | null;
          localidad?: string | null;
          notas?: string | null;
          activo?: boolean;
          etiqueta?: "fallecido" | null;
          presupuesto_logo_url?: string | null;
          presupuesto_cabecera_url?: string | null;
          plantilla_presupuesto?: "deportivo" | null;
        };
        Update: {
          nombre?: string;
          email?: string | null;
          telefono?: string | null;
          tipo_cliente?: "particular" | "empresa";
          cliente_padre_id?: string | null;
          documento_fiscal?: string | null;
          tipo_documento?: "dni" | "nie" | "cif" | "vat" | null;
          direccion?: string | null;
          codigo_postal?: string | null;
          localidad?: string | null;
          notas?: string | null;
          activo?: boolean;
          etiqueta?: "fallecido" | null;
          presupuesto_logo_url?: string | null;
          presupuesto_cabecera_url?: string | null;
          plantilla_presupuesto?: "deportivo" | null;
          updated_at?: string;
        };
      };
      facturas: {
        Row: {
          id: string;
          user_id: string;
          cliente_id: string | null;
          presupuesto_id: string | null;
          numero: string;
          estado: string;
          concepto: string | null;
          fecha_emision: string | null;
          fecha_vencimiento: string | null;
          base_imponible: number;
          porcentaje_impuesto: number;
          importe_impuesto: number;
          irpf_porcentaje: number;
          irpf_importe: number;
          porcentaje_descuento: number;
          importe_descuento: number;
          total: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          cliente_id?: string | null;
          presupuesto_id?: string | null;
          numero: string;
          estado?: string;
          concepto?: string | null;
          fecha_emision?: string | null;
          fecha_vencimiento?: string | null;
          irpf_porcentaje?: number;
        };
        Update: {
          cliente_id?: string | null;
          presupuesto_id?: string | null;
          numero?: string;
          estado?: string;
          concepto?: string | null;
          fecha_emision?: string | null;
          fecha_vencimiento?: string | null;
          irpf_porcentaje?: number;
          irpf_importe?: number;
          updated_at?: string;
        };
      };
      factura_lineas: {
        Row: {
          id: string;
          factura_id: string;
          descripcion: string;
          cantidad: number;
          precio_unitario: number;
          iva_porcentaje: number;
          orden: number;
        };
        Insert: {
          factura_id: string;
          descripcion: string;
          cantidad?: number;
          precio_unitario?: number;
          iva_porcentaje?: number;
          orden?: number;
        };
        Update: {
          descripcion?: string;
          cantidad?: number;
          precio_unitario?: number;
          iva_porcentaje?: number;
          orden?: number;
        };
      };
      presupuestos: {
        Row: {
          id: string;
          user_id: string;
          cliente_id: string | null;
          numero: string;
          estado: string;
          fecha: string | null;
          concepto: string | null;
          base_imponible: number;
          porcentaje_impuesto: number;
          importe_impuesto: number;
          porcentaje_descuento: number;
          importe_descuento: number;
          total: number;
          emisor_id: string;
          propuesta: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          cliente_id?: string | null;
          numero: string;
          estado?: string;
          fecha?: string | null;
          concepto?: string | null;
          emisor_id?: string;
          propuesta?: Json;
        };
        Update: {
          cliente_id?: string | null;
          numero?: string;
          estado?: string;
          fecha?: string | null;
          concepto?: string | null;
          emisor_id?: string;
          propuesta?: Json;
          updated_at?: string;
        };
      };
      propiedades: {
        Row: {
          id: string;
          user_id: string;
          ofertante_id: string | null;
          titulo: string | null;
          direccion: string | null;
          codigo_postal: string | null;
          localidad: string | null;
          tipo_operacion: string;
          precio_venta: number | null;
          precio_alquiler: number | null;
          superficie_m2: number | null;
          habitaciones: number | null;
          estado: string;
          notas: string | null;
          referencia: string | null;
          tipo_inmueble: string | null;
          tipologia: string | null;
          banos: number | null;
          aseos: number | null;
          planta: string | null;
          ascensor: boolean | null;
          anio_construccion: number | null;
          superficie_util: number | null;
          superficie_construida: number | null;
          superficie_parcela: number | null;
          referencia_catastral: string | null;
          lat: number | null;
          lng: number | null;
          descripcion: string | null;
          video_url: string | null;
          comercial_id: string | null;
          publicado: boolean;
          origen: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          ofertante_id?: string | null;
          titulo?: string | null;
          direccion?: string | null;
          codigo_postal?: string | null;
          localidad?: string | null;
          tipo_operacion?: string;
          precio_venta?: number | null;
          precio_alquiler?: number | null;
          superficie_m2?: number | null;
          habitaciones?: number | null;
          estado?: string;
          notas?: string | null;
          referencia?: string | null;
          tipo_inmueble?: string | null;
          tipologia?: string | null;
          banos?: number | null;
          aseos?: number | null;
          planta?: string | null;
          ascensor?: boolean | null;
          anio_construccion?: number | null;
          superficie_util?: number | null;
          superficie_construida?: number | null;
          superficie_parcela?: number | null;
          referencia_catastral?: string | null;
          descripcion?: string | null;
          video_url?: string | null;
          comercial_id?: string | null;
          publicado?: boolean;
          origen?: string;
        };
        Update: {
          ofertante_id?: string | null;
          titulo?: string | null;
          direccion?: string | null;
          codigo_postal?: string | null;
          localidad?: string | null;
          tipo_operacion?: string;
          precio_venta?: number | null;
          precio_alquiler?: number | null;
          superficie_m2?: number | null;
          habitaciones?: number | null;
          estado?: string;
          notas?: string | null;
          referencia?: string | null;
          tipo_inmueble?: string | null;
          tipologia?: string | null;
          banos?: number | null;
          aseos?: number | null;
          planta?: string | null;
          ascensor?: boolean | null;
          anio_construccion?: number | null;
          superficie_util?: number | null;
          superficie_construida?: number | null;
          superficie_parcela?: number | null;
          referencia_catastral?: string | null;
          descripcion?: string | null;
          video_url?: string | null;
          comercial_id?: string | null;
          publicado?: boolean;
          updated_at?: string;
        };
      };
      presupuesto_lineas: {
        Row: {
          id: string;
          presupuesto_id: string;
          descripcion: string;
          cantidad: number;
          precio_unitario: number;
          orden: number;
          unidad: string;
          capitulo: string | null;
        };
        Insert: {
          presupuesto_id: string;
          descripcion: string;
          cantidad?: number;
          precio_unitario?: number;
          orden?: number;
          unidad?: string;
          capitulo?: string | null;
        };
        Update: {
          descripcion?: string;
          cantidad?: number;
          precio_unitario?: number;
          orden?: number;
          unidad?: string;
          capitulo?: string | null;
        };
      };
      pagos: {
        Row: {
          id: string;
          factura_id: string;
          user_id: string;
          importe: number;
          fecha: string;
          metodo_pago: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          factura_id: string;
          user_id: string;
          importe: number;
          fecha?: string;
          metodo_pago?: string | null;
          notas?: string | null;
        };
        Update: {
          importe?: number;
          fecha?: string;
          metodo_pago?: string | null;
          notas?: string | null;
          updated_at?: string;
        };
      };
      emisores_presupuesto: {
        Row: {
          id: string;
          slug: "rehabinco" | "garal";
          nombre_corto: string;
          razon_social: string;
          nif: string;
          direccion: string;
          codigo_postal: string;
          localidad: string;
          provincia: string;
          telefono: string | null;
          email: string | null;
          iban: string | null;
          numero_cuenta_bancaria: string | null;
          logo_url: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: "rehabinco" | "garal";
          nombre_corto: string;
          razon_social?: string;
          nif?: string;
          direccion?: string;
          codigo_postal?: string;
          localidad?: string;
          provincia?: string;
          telefono?: string | null;
          email?: string | null;
          iban?: string | null;
          numero_cuenta_bancaria?: string | null;
          logo_url?: string | null;
          activo?: boolean;
        };
        Update: {
          slug?: "rehabinco" | "garal";
          nombre_corto?: string;
          razon_social?: string;
          nif?: string;
          direccion?: string;
          codigo_postal?: string;
          localidad?: string;
          provincia?: string;
          telefono?: string | null;
          email?: string | null;
          iban?: string | null;
          numero_cuenta_bancaria?: string | null;
          logo_url?: string | null;
          activo?: boolean;
          updated_at?: string;
        };
      };
      empresa_facturacion: {
        Row: {
          id: number;
          razon_social: string;
          nif: string;
          direccion: string;
          codigo_postal: string;
          localidad: string;
          provincia: string;
          telefono: string | null;
          email: string | null;
          iban: string | null;
          numero_cuenta_bancaria: string | null;
          logo_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          razon_social?: string;
          nif?: string;
          direccion?: string;
          codigo_postal?: string;
          localidad?: string;
          provincia?: string;
          telefono?: string | null;
          email?: string | null;
          iban?: string | null;
          numero_cuenta_bancaria?: string | null;
          logo_url?: string | null;
        };
        Update: {
          razon_social?: string;
          nif?: string;
          direccion?: string;
          codigo_postal?: string;
          localidad?: string;
          provincia?: string;
          telefono?: string | null;
          email?: string | null;
          iban?: string | null;
          numero_cuenta_bancaria?: string | null;
          logo_url?: string | null;
        };
      };
      partes_visita: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          estado: "borrador" | "pendiente_firma" | "firmado";
          visitante_nombre: string | null;
          visitante_documento: string | null;
          visitante_telefono: string | null;
          visitante_email: string | null;
          inmueble_direccion: string | null;
          inmueble_referencia: string | null;
          fecha_visita: string | null;
          hora_visita: string | null;
          agente_nombre: string | null;
          observaciones: string | null;
          lugar_firma: string;
          firma_visitante: string | null;
          firma_agente: string | null;
          firmado_en: string | null;
          propiedad_id: string | null;
          cliente_id: string | null;
          comercial_id: string | null;
          cita_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          token?: string;
          estado?: "borrador" | "pendiente_firma" | "firmado";
          visitante_nombre?: string | null;
          visitante_documento?: string | null;
          visitante_telefono?: string | null;
          visitante_email?: string | null;
          inmueble_direccion?: string | null;
          inmueble_referencia?: string | null;
          fecha_visita?: string | null;
          hora_visita?: string | null;
          agente_nombre?: string | null;
          observaciones?: string | null;
          lugar_firma?: string;
          firma_visitante?: string | null;
          firma_agente?: string | null;
          firmado_en?: string | null;
          propiedad_id?: string | null;
          cliente_id?: string | null;
          comercial_id?: string | null;
          cita_id?: string | null;
        };
        Update: {
          estado?: "borrador" | "pendiente_firma" | "firmado";
          visitante_nombre?: string | null;
          visitante_documento?: string | null;
          visitante_telefono?: string | null;
          visitante_email?: string | null;
          inmueble_direccion?: string | null;
          inmueble_referencia?: string | null;
          fecha_visita?: string | null;
          hora_visita?: string | null;
          agente_nombre?: string | null;
          observaciones?: string | null;
          lugar_firma?: string;
          firma_visitante?: string | null;
          firma_agente?: string | null;
          firmado_en?: string | null;
          propiedad_id?: string | null;
          cliente_id?: string | null;
          comercial_id?: string | null;
          cita_id?: string | null;
          updated_at?: string;
        };
      };
      inmueble_media: {
        Row: {
          id: string;
          propiedad_id: string;
          user_id: string;
          tipo: "foto" | "video" | "plano";
          path: string;
          url: string;
          orden: number;
          portada: boolean;
          created_at: string;
        };
        Insert: {
          propiedad_id: string;
          user_id: string;
          tipo?: "foto" | "video" | "plano";
          path: string;
          url: string;
          orden?: number;
          portada?: boolean;
        };
        Update: {
          tipo?: "foto" | "video" | "plano";
          path?: string;
          url?: string;
          orden?: number;
          portada?: boolean;
        };
      };
      inmueble_documentos: {
        Row: {
          id: string;
          propiedad_id: string;
          user_id: string;
          tipo: string;
          nombre: string;
          path: string;
          created_at: string;
        };
        Insert: {
          propiedad_id: string;
          user_id: string;
          tipo?: string;
          nombre: string;
          path: string;
        };
        Update: {
          tipo?: string;
          nombre?: string;
          path?: string;
        };
      };
      catastro_explorer_pipeline: {
        Row: {
          finca_reference: string;
          estado: string;
          proxima_accion: string | null;
          proxima_accion_en: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          finca_reference: string;
          estado?: string;
          proxima_accion?: string | null;
          proxima_accion_en?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          estado?: string;
          proxima_accion?: string | null;
          proxima_accion_en?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
      };
      catastro_explorer_actividad: {
        Row: {
          id: string;
          finca_reference: string;
          actor_id: string | null;
          tipo: string;
          detalle: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          finca_reference: string;
          actor_id?: string | null;
          tipo: string;
          detalle?: string | null;
          payload?: Json;
        };
        Update: {
          tipo?: string;
          detalle?: string | null;
          payload?: Json;
        };
      };
      demandas: {
        Row: {
          id: string;
          cliente_id: string;
          comercial_id: string;
          tipo_operacion: string;
          tipos_inmueble: string[];
          zonas: string[];
          presupuesto_min: number | null;
          presupuesto_max: number | null;
          superficie_min: number | null;
          superficie_max: number | null;
          habitaciones_min: number | null;
          banos_min: number | null;
          requisitos: string | null;
          estado: string;
          origen: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          cliente_id: string;
          comercial_id: string;
          tipo_operacion?: string;
          tipos_inmueble?: string[];
          zonas?: string[];
          presupuesto_min?: number | null;
          presupuesto_max?: number | null;
          superficie_min?: number | null;
          superficie_max?: number | null;
          habitaciones_min?: number | null;
          banos_min?: number | null;
          requisitos?: string | null;
          estado?: string;
          origen?: string | null;
        };
        Update: {
          tipo_operacion?: string;
          tipos_inmueble?: string[];
          zonas?: string[];
          presupuesto_min?: number | null;
          presupuesto_max?: number | null;
          superficie_min?: number | null;
          superficie_max?: number | null;
          habitaciones_min?: number | null;
          banos_min?: number | null;
          requisitos?: string | null;
          estado?: string;
          origen?: string | null;
          updated_at?: string;
        };
      };
      demanda_inmuebles: {
        Row: {
          id: string;
          demanda_id: string;
          propiedad_id: string;
          origen: string;
          puntuacion: number;
          estado: string;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          demanda_id: string;
          propiedad_id: string;
          origen?: string;
          puntuacion?: number;
          estado?: string;
          notas?: string | null;
        };
        Update: {
          origen?: string;
          puntuacion?: number;
          estado?: string;
          notas?: string | null;
        };
      };
      citas: {
        Row: {
          id: string;
          comercial_id: string;
          tipo: string;
          titulo: string;
          empieza: string;
          termina: string;
          propiedad_id: string | null;
          cliente_id: string | null;
          demanda_id: string | null;
          finca_reference: string | null;
          estado: string;
          created_at: string;
        };
        Insert: {
          comercial_id: string;
          tipo?: string;
          titulo: string;
          empieza: string;
          termina: string;
          propiedad_id?: string | null;
          cliente_id?: string | null;
          demanda_id?: string | null;
          finca_reference?: string | null;
          estado?: string;
        };
        Update: {
          tipo?: string;
          titulo?: string;
          empieza?: string;
          termina?: string;
          propiedad_id?: string | null;
          cliente_id?: string | null;
          demanda_id?: string | null;
          finca_reference?: string | null;
          estado?: string;
        };
      };
      tareas: {
        Row: {
          id: string;
          comercial_id: string;
          creado_por: string;
          mencionados: string[];
          titulo: string;
          vence: string | null;
          estado: string;
          finca_reference: string | null;
          propiedad_id: string | null;
          cliente_id: string | null;
          demanda_id: string | null;
          cita_id: string | null;
          hora?: string | null;
          parte_visita_id?: string | null;
          created_at: string;
        };
        Insert: {
          comercial_id: string;
          creado_por?: string;
          mencionados?: string[];
          titulo: string;
          vence?: string | null;
          hora?: string | null;
          estado?: string;
          finca_reference?: string | null;
          propiedad_id?: string | null;
          cliente_id?: string | null;
          demanda_id?: string | null;
          cita_id?: string | null;
          parte_visita_id?: string | null;
        };
        Update: {
          titulo?: string;
          vence?: string | null;
          hora?: string | null;
          estado?: string;
          finca_reference?: string | null;
          propiedad_id?: string | null;
          cliente_id?: string | null;
          demanda_id?: string | null;
          cita_id?: string | null;
          comercial_id?: string;
          mencionados?: string[];
          parte_visita_id?: string | null;
        };
      };
      tareas_actividad: {
        Row: {
          id: string;
          tarea_id: string;
          actor_id: string | null;
          tipo: string;
          texto: string;
          mencionados: string[];
          created_at: string;
        };
        Insert: {
          tarea_id: string;
          actor_id?: string | null;
          tipo?: string;
          texto: string;
          mencionados?: string[];
        };
        Update: {
          texto?: string;
          tipo?: string;
        };
      };
      captacion_alertas: {
        Row: {
          id: string;
          nombre: string;
          portales: string[];
          zonas: string[];
          center_lat: number | null;
          center_lng: number | null;
          radio_m: number;
          operacion: string;
          tipo: string | null;
          precio_max: number | null;
          m2_min: number | null;
          solo_particulares: boolean;
          frecuencia: string;
          activa: boolean;
          comercial_id: string | null;
          created_by: string;
          last_sync_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          nombre: string;
          portales?: string[];
          zonas?: string[];
          center_lat?: number | null;
          center_lng?: number | null;
          radio_m?: number;
          operacion?: string;
          tipo?: string | null;
          precio_max?: number | null;
          m2_min?: number | null;
          solo_particulares?: boolean;
          frecuencia?: string;
          activa?: boolean;
          comercial_id?: string | null;
          created_by: string;
        };
        Update: {
          nombre?: string;
          portales?: string[];
          zonas?: string[];
          activa?: boolean;
          comercial_id?: string | null;
          last_sync_at?: string | null;
          updated_at?: string;
        };
      };
      captacion_anuncios: {
        Row: {
          id: string;
          fuente: string;
          externo_id: string;
          url: string | null;
          titulo: string;
          descripcion: string | null;
          operacion: string;
          tipo: string | null;
          anunciante: string;
          precio: number | null;
          precio_anterior: number | null;
          superficie: number | null;
          habitaciones: number | null;
          banos: number | null;
          direccion: string | null;
          zona: string | null;
          municipio: string | null;
          codigo_postal: string | null;
          lat: number | null;
          lng: number | null;
          thumb: string | null;
          n_fotos: number | null;
          fotos: Json;
          contacto_nombre: string | null;
          contacto_telefono: string | null;
          contacto_clave: string | null;
          tags: string[];
          alerta_id: string | null;
          fase: string;
          comercial_id: string | null;
          proxima_accion: string | null;
          propiedad_id: string | null;
          cliente_id: string | null;
          publicado_en: string | null;
          visto_en: string;
          desaparecido_en: string | null;
          raw: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          fuente: string;
          externo_id: string;
          url?: string | null;
          titulo: string;
          descripcion?: string | null;
          operacion?: string;
          tipo?: string | null;
          anunciante?: string;
          precio?: number | null;
          precio_anterior?: number | null;
          superficie?: number | null;
          habitaciones?: number | null;
          banos?: number | null;
          direccion?: string | null;
          zona?: string | null;
          municipio?: string | null;
          codigo_postal?: string | null;
          lat?: number | null;
          lng?: number | null;
          thumb?: string | null;
          n_fotos?: number | null;
          fotos?: Json;
          contacto_nombre?: string | null;
          contacto_telefono?: string | null;
          contacto_clave?: string | null;
          tags?: string[];
          alerta_id?: string | null;
          fase?: string;
          comercial_id?: string | null;
          proxima_accion?: string | null;
          propiedad_id?: string | null;
          cliente_id?: string | null;
          publicado_en?: string | null;
          visto_en?: string;
          desaparecido_en?: string | null;
          raw?: Json;
        };
        Update: {
          url?: string | null;
          titulo?: string;
          precio?: number | null;
          precio_anterior?: number | null;
          tags?: string[];
          fase?: string;
          comercial_id?: string | null;
          proxima_accion?: string | null;
          propiedad_id?: string | null;
          cliente_id?: string | null;
          visto_en?: string;
          desaparecido_en?: string | null;
          updated_at?: string;
          raw?: Json;
        };
      };
      captacion_anuncios_actividad: {
        Row: {
          id: string;
          anuncio_id: string;
          actor_id: string | null;
          tipo: string;
          detalle: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          anuncio_id: string;
          actor_id?: string | null;
          tipo: string;
          detalle?: string | null;
          payload?: Json;
        };
        Update: {
          detalle?: string | null;
        };
      };
      captacion_notificaciones: {
        Row: {
          id: string;
          user_id: string;
          tipo: string;
          titulo: string;
          detalle: string | null;
          anuncio_id: string | null;
          leida: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          tipo: string;
          titulo: string;
          detalle?: string | null;
          anuncio_id?: string | null;
          leida?: boolean;
        };
        Update: {
          leida?: boolean;
        };
      };
      captacion_notif_prefs: {
        Row: {
          user_id: string;
          nuevos: boolean;
          bajada: boolean;
          retirado: boolean;
          telefono_repite: boolean;
          sin_mover: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          nuevos?: boolean;
          bajada?: boolean;
          retirado?: boolean;
          telefono_repite?: boolean;
          sin_mover?: boolean;
          updated_at?: string;
        };
        Update: {
          nuevos?: boolean;
          bajada?: boolean;
          retirado?: boolean;
          telefono_repite?: boolean;
          sin_mover?: boolean;
          updated_at?: string;
        };
      };
    };
  };
}
