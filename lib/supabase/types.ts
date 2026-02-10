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
        Row: { id: string; email: string | null; role: string; created_at: string; updated_at: string };
        Insert: { id: string; email?: string | null; role?: string };
        Update: { email?: string | null; role?: string; updated_at?: string };
      };
      clientes: {
        Row: {
          id: string;
          user_id: string;
          nombre: string;
          email: string | null;
          telefono: string | null;
          nif: string | null;
          direccion: string | null;
          notas: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          nombre: string;
          email?: string | null;
          telefono?: string | null;
          nif?: string | null;
          direccion?: string | null;
          notas?: string | null;
          activo?: boolean;
        };
        Update: {
          nombre?: string;
          email?: string | null;
          telefono?: string | null;
          nif?: string | null;
          direccion?: string | null;
          notas?: string | null;
          activo?: boolean;
          updated_at?: string;
        };
      };
      facturas: {
        Row: {
          id: string;
          user_id: string;
          cliente_id: string | null;
          numero: string;
          estado: string;
          concepto: string | null;
          fecha_emision: string | null;
          fecha_vencimiento: string | null;
          base_imponible: number;
          porcentaje_impuesto: number;
          importe_impuesto: number;
          porcentaje_descuento: number;
          importe_descuento: number;
          total: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          cliente_id?: string | null;
          numero: string;
          estado?: string;
          concepto?: string | null;
          fecha_emision?: string | null;
          fecha_vencimiento?: string | null;
        };
        Update: {
          cliente_id?: string | null;
          numero?: string;
          estado?: string;
          concepto?: string | null;
          fecha_emision?: string | null;
          fecha_vencimiento?: string | null;
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
          orden: number;
        };
        Insert: {
          factura_id: string;
          descripcion: string;
          cantidad?: number;
          precio_unitario?: number;
          orden?: number;
        };
        Update: {
          descripcion?: string;
          cantidad?: number;
          precio_unitario?: number;
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
        };
        Update: {
          cliente_id?: string | null;
          numero?: string;
          estado?: string;
          fecha?: string | null;
          concepto?: string | null;
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
        };
        Insert: {
          presupuesto_id: string;
          descripcion: string;
          cantidad?: number;
          precio_unitario?: number;
          orden?: number;
        };
        Update: {
          descripcion?: string;
          cantidad?: number;
          precio_unitario?: number;
          orden?: number;
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
    };
  };
}
