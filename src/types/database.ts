/**
 * Shared domain types for GHASILAK.
 * Keep in sync with supabase/migrations. Prefer regenerating Database types
 * via `pnpm db:types` once a local/remote Supabase project is connected.
 */

export type AppRole = "customer" | "driver" | "admin" | "manager" | "finance";
export type PreferredLanguage = "ar" | "en";
export type DriverStatus = "pending" | "active" | "inactive" | "suspended";
export type PartnerStatus = "active" | "inactive" | "suspended";

export type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "pickup_assigned"
  | "driver_assigned"
  | "driver_on_way"
  | "picked_up"
  | "at_laundry"
  | "received_at_laundry"
  | "washing"
  | "ironing"
  | "quality_check"
  | "ready"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "failed";

export type PaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "wallet"
  | "online";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type SettlementStatus =
  | "draft"
  | "pending"
  | "approved"
  | "paid"
  | "cancelled";

export type CommissionStatus =
  | "pending"
  | "approved"
  | "settled"
  | "cancelled";

export type CashHandoverStatus =
  | "pending"
  | "submitted"
  | "confirmed"
  | "disputed"
  | "rejected"
  | "cancelled";

export type FinancialTxType =
  | "order_payment"
  | "customer_payment"
  | "laundry_payable"
  | "laundry_payment"
  | "driver_commission"
  | "driver_payment"
  | "cash_collected"
  | "cash_handover"
  | "refund"
  | "discount"
  | "business_expense"
  | "owner_contribution"
  | "owner_withdrawal"
  | "driver_settlement"
  | "laundry_settlement"
  | "expense"
  | "adjustment"
  | "promo_discount"
  | "other";

export type ExpenseStatus = "draft" | "approved" | "paid" | "rejected";
export type ComplaintStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed"
  | "rejected";

export type ComplaintType =
  | "late_delivery"
  | "missing_item"
  | "damaged_item"
  | "poor_cleaning"
  | "payment_issue"
  | "other";
export type NotificationChannel =
  | "in_app"
  | "sms"
  | "whatsapp"
  | "email"
  | "push";
export type PhotoKind = "pickup" | "delivery" | "damage" | "other";

/** OMR money as a decimal string with exactly 3 fractional digits, e.g. "0.400" */
export type OmrAmount = string;

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: AppRole;
  preferred_language: PreferredLanguage;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  profile_id: string;
  notes: string | null;
  default_address_id: string | null;
  total_orders: number;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  customer_id: string;
  label: string | null;
  area_code: string;
  area_name_en: string;
  area_name_ar: string;
  street: string | null;
  building: string | null;
  floor: string | null;
  unit: string | null;
  landmark: string | null;
  wilayat: string | null;
  governorate: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  profile_id: string;
  status: DriverStatus;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  license_number: string | null;
  national_id: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  is_available: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  notes: string | null;
  hired_at: string | null;
  commission_rule_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverCommissionRule {
  id: string;
  name_en: string;
  name_ar: string;
  commission_percent: OmrAmount;
  flat_amount_omr: OmrAmount;
  is_default: boolean;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaundryPartner {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  area_code: string;
  area_name_en: string;
  area_name_ar: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address_line: string | null;
  status: PartnerStatus;
  default_cost_per_piece_omr: OmrAmount;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  category_id: string | null;
  code: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  default_customer_price_omr: OmrAmount;
  default_partner_cost_omr: OmrAmount;
  is_special_item: boolean;
  unit_label_en: string;
  unit_label_ar: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServicePartnerPrice {
  id: string;
  service_id: string;
  partner_id: string;
  customer_price_omr: OmrAmount;
  partner_cost_omr: OmrAmount;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceZone {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  governorate_en: string;
  governorate_ar: string;
  is_active: boolean;
  sort_order: number;
  default_partner_id: string | null;
  min_order_omr?: OmrAmount | null;
  delivery_fee_omr?: OmrAmount;
  estimated_turnaround_hours?: number | null;
  created_at: string;
  updated_at: string;
}

export interface PickupSlot {
  id: string;
  zone_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  partner_id: string | null;
  pickup_driver_id: string | null;
  delivery_driver_id: string | null;
  pickup_address_id: string | null;
  delivery_address_id: string | null;
  zone_id: string | null;
  status: OrderStatus;
  preferred_language: PreferredLanguage;
  pickup_slot_id: string | null;
  scheduled_pickup_at: string | null;
  scheduled_delivery_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  piece_count: number;
  estimated_piece_count?: number;
  confirmed_piece_count?: number | null;
  subtotal_omr: OmrAmount;
  discount_omr: OmrAmount;
  delivery_fee_omr: OmrAmount;
  vat_rate?: OmrAmount;
  vat_omr: OmrAmount;
  total_omr: OmrAmount;
  partner_cost_total_omr: OmrAmount;
  driver_commission_percent: OmrAmount | null;
  driver_commission_omr: OmrAmount;
  packaging_cost_omr?: OmrAmount;
  other_direct_cost_omr?: OmrAmount;
  contribution_omr?: OmrAmount;
  margin_percentage?: OmrAmount;
  currency_code: "OMR";
  promo_code_id: string | null;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  customer_notes: string | null;
  internal_notes: string | null;
  qr_token?: string | null;
  invoice_number?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  service_id: string | null;
  service_code: string;
  service_name_en: string;
  service_name_ar: string;
  quantity: number;
  unit_price_omr: OmrAmount;
  partner_unit_cost_omr: OmrAmount;
  line_total_omr: OmrAmount;
  partner_line_cost_omr: OmrAmount;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface OrderPhoto {
  id: string;
  order_id: string;
  uploaded_by: string | null;
  kind: PhotoKind;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount_omr: OmrAmount;
  currency_code: "OMR";
  method: PaymentMethod;
  status: PaymentStatus;
  provider: string | null;
  provider_reference: string | null;
  collected_by_driver_id: string | null;
  collected_by_profile_id: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromoCode {
  id: string;
  code: string;
  description_en: string | null;
  description_ar: string | null;
  discount_type: "percent" | "fixed";
  discount_value: OmrAmount;
  max_discount_omr: OmrAmount | null;
  min_order_omr: OmrAmount;
  usage_limit: number | null;
  usage_count: number;
  per_customer_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromoRedemption {
  id: string;
  promo_code_id: string;
  order_id: string;
  customer_id: string;
  discount_omr: OmrAmount;
  created_at: string;
}

export interface DriverCommission {
  id: string;
  order_id: string;
  driver_id: string;
  commission_rule_id: string | null;
  commission_percent: OmrAmount;
  base_amount_omr: OmrAmount;
  commission_omr: OmrAmount;
  status: CommissionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverSettlement {
  id: string;
  settlement_number: string;
  driver_id: string;
  period_start: string;
  period_end: string;
  status: SettlementStatus;
  gross_commission_omr: OmrAmount;
  deductions_omr: OmrAmount;
  net_amount_omr: OmrAmount;
  currency_code: "OMR";
  paid_at: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverSettlementItem {
  id: string;
  settlement_id: string;
  commission_id: string;
  amount_omr: OmrAmount;
  created_at: string;
}

export interface LaundrySettlement {
  id: string;
  settlement_number: string;
  partner_id: string;
  period_start: string;
  period_end: string;
  status: SettlementStatus;
  gross_cost_omr: OmrAmount;
  deductions_omr: OmrAmount;
  net_amount_omr: OmrAmount;
  currency_code: "OMR";
  paid_at: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaundrySettlementItem {
  id: string;
  settlement_id: string;
  order_id: string;
  amount_omr: OmrAmount;
  created_at: string;
}

export interface CashHandover {
  id: string;
  driver_id: string;
  received_by: string | null;
  amount_omr: OmrAmount;
  currency_code: "OMR";
  status: CashHandoverStatus;
  handed_over_at: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialTransaction {
  id: string;
  tx_type: FinancialTxType;
  amount_omr: OmrAmount;
  currency_code: "OMR";
  direction: "in" | "out";
  order_id: string | null;
  payment_id: string | null;
  customer_id?: string | null;
  driver_id?: string | null;
  laundry_partner_id?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  reverses_tx_id?: string | null;
  driver_settlement_id: string | null;
  laundry_settlement_id: string | null;
  cash_handover_id: string | null;
  reference: string | null;
  description: string | null;
  created_by: string | null;
  occurred_at: string;
  created_at: string;
}

export interface BusinessExpense {
  id: string;
  category: string;
  expense_category?: string;
  description: string;
  amount_omr: OmrAmount;
  currency_code: "OMR";
  status: ExpenseStatus;
  incurred_on: string;
  vendor_name: string | null;
  receipt_path: string | null;
  approved_by: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Complaint {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  opened_by: string | null;
  assigned_to: string | null;
  subject: string;
  description: string;
  complaint_type?: ComplaintType;
  compensation_omr?: OmrAmount;
  refund_transaction_id?: string | null;
  status: ComplaintStatus;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rating {
  id: string;
  order_id: string;
  customer_id: string;
  driver_id: string | null;
  partner_id: string | null;
  overall_score: number;
  driver_score: number | null;
  laundry_score: number | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  profile_id: string;
  channel: NotificationChannel;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  data: Record<string, unknown>;
  order_id: string | null;
  is_read: boolean;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface BusinessSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

type TableDef<
  Row,
  Insert = Partial<Row>,
  Update = Partial<Row>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/** Minimal Database shape for typed Supabase clients until `pnpm db:types` is run. */
export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile, Partial<Profile> & { id: string }>;
      customers: TableDef<Customer>;
      addresses: TableDef<
        Address,
        Partial<Address> & {
          customer_id: string;
          area_code: string;
          area_name_en: string;
          area_name_ar: string;
        }
      >;
      drivers: TableDef<Driver, Partial<Driver> & { profile_id: string }>;
      driver_commission_rules: TableDef<
        DriverCommissionRule,
        Partial<DriverCommissionRule> & {
          name_en: string;
          name_ar: string;
          commission_percent: OmrAmount;
        }
      >;
      laundry_partners: TableDef<
        LaundryPartner,
        Partial<LaundryPartner> & {
          code: string;
          name_en: string;
          name_ar: string;
          area_code: string;
          area_name_en: string;
          area_name_ar: string;
        }
      >;
      service_categories: TableDef<
        ServiceCategory,
        Partial<ServiceCategory> & { code: string; name_en: string; name_ar: string }
      >;
      services: TableDef<
        Service,
        Partial<Service> & { code: string; name_en: string; name_ar: string }
      >;
      service_partner_prices: TableDef<
        ServicePartnerPrice,
        Partial<ServicePartnerPrice> & {
          service_id: string;
          partner_id: string;
          customer_price_omr: OmrAmount;
          partner_cost_omr: OmrAmount;
        }
      >;
      service_zones: TableDef<
        ServiceZone,
        Partial<ServiceZone> & { code: string; name_en: string; name_ar: string }
      >;
      pickup_slots: TableDef<
        PickupSlot,
        Partial<PickupSlot> & {
          day_of_week: number;
          start_time: string;
          end_time: string;
        }
      >;
      orders: TableDef<Order, Partial<Order> & { customer_id: string }>;
      order_items: TableDef<
        OrderItem,
        Partial<OrderItem> & {
          order_id: string;
          service_code: string;
          service_name_en: string;
          service_name_ar: string;
          quantity: number;
          unit_price_omr: OmrAmount;
          partner_unit_cost_omr: OmrAmount;
          line_total_omr: OmrAmount;
          partner_line_cost_omr: OmrAmount;
        }
      >;
      order_status_history: TableDef<
        OrderStatusHistory,
        Partial<OrderStatusHistory> & { order_id: string; to_status: OrderStatus }
      >;
      order_photos: TableDef<
        OrderPhoto,
        Partial<OrderPhoto> & { order_id: string; storage_path: string }
      >;
      payments: TableDef<
        Payment,
        Partial<Payment> & {
          order_id: string;
          amount_omr: OmrAmount;
          method: PaymentMethod;
        }
      >;
      promo_codes: TableDef<
        PromoCode,
        Partial<PromoCode> & {
          code: string;
          discount_type: "percent" | "fixed";
          discount_value: OmrAmount;
        }
      >;
      promo_redemptions: TableDef<
        PromoRedemption,
        Partial<PromoRedemption> & {
          promo_code_id: string;
          order_id: string;
          customer_id: string;
          discount_omr: OmrAmount;
        }
      >;
      driver_commissions: TableDef<
        DriverCommission,
        Partial<DriverCommission> & {
          order_id: string;
          driver_id: string;
          commission_percent: OmrAmount;
          base_amount_omr: OmrAmount;
          commission_omr: OmrAmount;
        }
      >;
      driver_settlements: TableDef<
        DriverSettlement,
        Partial<DriverSettlement> & {
          driver_id: string;
          period_start: string;
          period_end: string;
        }
      >;
      driver_settlement_items: TableDef<
        DriverSettlementItem,
        Partial<DriverSettlementItem> & {
          settlement_id: string;
          commission_id: string;
          amount_omr: OmrAmount;
        }
      >;
      laundry_settlements: TableDef<
        LaundrySettlement,
        Partial<LaundrySettlement> & {
          partner_id: string;
          period_start: string;
          period_end: string;
        }
      >;
      laundry_settlement_items: TableDef<
        LaundrySettlementItem,
        Partial<LaundrySettlementItem> & {
          settlement_id: string;
          order_id: string;
          amount_omr: OmrAmount;
        }
      >;
      cash_handovers: TableDef<
        CashHandover,
        Partial<CashHandover> & { driver_id: string; amount_omr: OmrAmount }
      >;
      financial_transactions: TableDef<
        FinancialTransaction,
        Partial<FinancialTransaction> & {
          tx_type: FinancialTxType;
          amount_omr: OmrAmount;
          direction: "in" | "out";
        }
      >;
      business_expenses: TableDef<
        BusinessExpense,
        Partial<BusinessExpense> & {
          category: string;
          description: string;
          amount_omr: OmrAmount;
        }
      >;
      complaints: TableDef<
        Complaint,
        Partial<Complaint> & { subject: string; description: string }
      >;
      ratings: TableDef<
        Rating,
        Partial<Rating> & {
          order_id: string;
          customer_id: string;
          overall_score: number;
        }
      >;
      notifications: TableDef<
        Notification,
        Partial<Notification> & {
          profile_id: string;
          title_en: string;
          title_ar: string;
          body_en: string;
          body_ar: string;
        }
      >;
      business_settings: TableDef<
        BusinessSetting,
        Partial<BusinessSetting> & { key: string; value: unknown }
      >;
      audit_logs: TableDef<
        AuditLog,
        Partial<AuditLog> & { action: string; entity_type: string }
      >;
    };
    Views: {
      customer_orders: {
        Row: {
          id: string;
          order_number: string;
          invoice_number: string | null;
          customer_id: string;
          status: OrderStatus;
          preferred_language: PreferredLanguage;
          pickup_address_id: string | null;
          delivery_address_id: string | null;
          pickup_slot_id: string | null;
          scheduled_pickup_at: string | null;
          scheduled_delivery_at: string | null;
          piece_count: number;
          estimated_piece_count: number;
          confirmed_piece_count: number | null;
          subtotal_omr: OmrAmount;
          discount_omr: OmrAmount;
          delivery_fee_omr: OmrAmount;
          vat_rate: OmrAmount;
          vat_omr: OmrAmount;
          total_omr: OmrAmount;
          currency_code: string;
          payment_method: PaymentMethod | null;
          payment_status: PaymentStatus;
          customer_notes: string | null;
          created_at: string;
          updated_at: string;
          delivered_at: string | null;
          cancelled_at: string | null;
        };
        Relationships: [];
      };
      customer_order_items: {
        Row: {
          id: string;
          order_id: string;
          service_id: string | null;
          service_code: string;
          service_name_en: string;
          service_name_ar: string;
          quantity: number;
          estimated_quantity: number | null;
          confirmed_quantity: number | null;
          unit_price_omr: OmrAmount;
          line_total_omr: OmrAmount;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
      driver_order_cards: {
        Row: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: AppRole };
      generate_order_number: { Args: Record<string, never>; Returns: string };
      generate_laundry_settlement_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      generate_driver_settlement_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      resolve_order_qr: {
        Args: { p_token: string };
        Returns: { order_id: string; viewer: string }[];
      };
    };
    Enums: {
      app_role: AppRole;
      preferred_language: PreferredLanguage;
      driver_status: DriverStatus;
      partner_status: PartnerStatus;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      settlement_status: SettlementStatus;
      commission_status: CommissionStatus;
      cash_handover_status: CashHandoverStatus;
      financial_tx_type: FinancialTxType;
      expense_status: ExpenseStatus;
      complaint_status: ComplaintStatus;
      notification_channel: NotificationChannel;
      photo_kind: PhotoKind;
    };
    CompositeTypes: Record<string, never>;
  };
};
