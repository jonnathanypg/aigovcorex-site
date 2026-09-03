import { NextRequest, NextResponse } from 'next/server';

export interface BetaRegistrationPayload {
  company_name: string;
  industry: string;
  employee_count: string;
  products_services?: string;
  ai_experience?: string;
  ai_expectations?: string;
  contact_name: string;
  role_in_company: string;
  email: string;
  phone: string;
  submitted_at?: string;
  ip?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: BetaRegistrationPayload = await req.json();

    // 1. Validation
    if (
      !body.company_name?.trim() ||
      !body.contact_name?.trim() ||
      !body.email?.trim() ||
      !body.phone?.trim() ||
      !body.role_in_company?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields (company, name, email, phone, role)',
        },
        { status: 400 }
      );
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email address format',
        },
        { status: 400 }
      );
    }

    const leadRecord = {
      ...body,
      company_name: body.company_name.trim(),
      contact_name: body.contact_name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      role_in_company: body.role_in_company.trim(),
      submitted_at: new Date().toISOString(),
      source: 'AI GovCoreX VIP Beta Form',
    };

    console.log('[AI GovCoreX] New VIP Beta Lead Registered:', {
      company: leadRecord.company_name,
      contact: leadRecord.contact_name,
      email: leadRecord.email,
      industry: leadRecord.industry,
      timestamp: leadRecord.submitted_at,
    });

    // 2. Dispatch to Webhook if configured (Make, Zapier, Telegram, Discord, CRM Gateway)
    const webhookUrl = process.env.LEADS_WEBHOOK_URL;
    if (webhookUrl && webhookUrl.startsWith('http')) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'vip_beta_registration',
            lead: leadRecord,
            summary: `🏛️ New Lead: ${leadRecord.contact_name} (${leadRecord.role_in_company}) from "${leadRecord.company_name}" [${leadRecord.industry || 'General'}] - Email: ${leadRecord.email} - Phone: ${leadRecord.phone}`,
          }),
        });
      } catch (webhookErr) {
        console.error('[AI GovCoreX] Webhook dispatch error (non-fatal):', webhookErr);
      }
    }

    // 3. Return successful response
    return NextResponse.json(
      {
        success: true,
        message: 'Lead registered successfully',
        timestamp: leadRecord.submitted_at,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[AI GovCoreX] Error processing beta registration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error processing registration',
      },
      { status: 500 }
    );
  }
}
