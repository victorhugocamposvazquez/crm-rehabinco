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
          ofertante_id: string;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          ofertante_id: string;
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
        };
        Update: {
          ofertante_id?: string;
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
    };
  };
}
