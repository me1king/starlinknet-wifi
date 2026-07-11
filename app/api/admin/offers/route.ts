import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WIFI_BILLING_CATALOG } from '@/app/config/packages';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let siteId = searchParams.get('siteId') || 'default-site';

    // Fallback if MikroTik variable was not replaced
    if (siteId.includes('$') || siteId.includes('identity')) {
      siteId = 'default-site';
    }

    const dbOffers = await prisma.voucherOffer.findMany({
      where: { siteId },
      orderBy: { price: 'asc' }
    }).catch(err => {
      console.warn("DB Offers fetch failed, using fallback:", err.message);
      return [];
    });

    const staticOffers = Object.values(WIFI_BILLING_CATALOG).map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      duration: `${pkg.durationHours} Hours`,
      durationMin: pkg.durationHours * 60,
      price: pkg.price,
      maxDevices: 1,
      downloadLimit: pkg.speedLimit,
      uploadLimit: "Unlimited",
      speedLimit: pkg.speedLimit,
      isSystem: false, // Unlocked
    }));

    // If DB is empty or failed, return static catalog immediately
    if (dbOffers.length === 0) {
      return NextResponse.json(staticOffers.map(o => ({
        ...o,
        max_devices: o.maxDevices,
        download_limit: o.downloadLimit,
        upload_limit: o.uploadLimit,
        expiry_mode: "CONTINUOUS"
      })), { status: 200 });
    }

    // Merge and map, adding a calculated duration string if missing
    const mappedDbOffers = dbOffers.map(offer => {
      let durationStr = offer.duration;
      if (!durationStr && offer.durationMin) {
        if (offer.durationMin >= 1440) {
          durationStr = `${Math.floor(offer.durationMin / 1440)} Day(s)`;
        } else if (offer.durationMin >= 60) {
          durationStr = `${Math.floor(offer.durationMin / 60)} Hour(s)`;
        } else {
          durationStr = `${offer.durationMin} Mins`;
        }
      }

      return {
        ...offer,
        duration: durationStr,
        max_devices: offer.maxDevices,
        download_limit: offer.downloadLimit,
        upload_limit: offer.uploadLimit,
        expiry_mode: offer.expiryMode,
        isSystem: false // Database offers are always editable
      };
    });

    // Also include static offers if they aren't already in the DB by name
    const existingNames = new Set(dbOffers.map(o => o.name.toLowerCase()));
    const additionalOffers = staticOffers
      .filter(o => !existingNames.has(o.name.toLowerCase()))
      .map(o => ({
        ...o,
        max_devices: o.maxDevices,
        download_limit: o.downloadLimit,
        upload_limit: o.uploadLimit,
        expiry_mode: "CONTINUOUS"
      }));

    return NextResponse.json([...mappedDbOffers, ...additionalOffers], { status: 200 });
  } catch (error: any) {
    console.error("Critical Offers Error:", error.message);
    // Absolute final fallback to ensure JSON is always returned
    return NextResponse.json([{ id: '1hr', name: '1 Hour Standard', price: 15, duration: '1 Hour' }], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name, duration, price, maxDevices,
      downloadLimit, uploadLimit, expiryMode,
      dataLimitMB, siteId, durationMin
    } = body;

    // Generate a secure ID if missing to prevent "Argument id is missing" error
    const finalId = body.id || `offer_${Math.random().toString(36).substring(2, 11)}`;

    // Support camelCase from UI but map to DB if needed
    const finalDataLimit = dataLimitMB ? parseInt(dataLimitMB) : (body.data_limit_mb ? parseInt(body.data_limit_mb) : null);

    // Auto-generate duration string if not provided
    let finalDuration = duration;
    if (!finalDuration && durationMin) {
      const mins = parseInt(durationMin);
      if (mins >= 1440) finalDuration = `${Math.floor(mins / 1440)} Day(s)`;
      else if (mins >= 60) finalDuration = `${Math.floor(mins / 60)} Hour(s)`;
      else finalDuration = `${mins} Mins`;
    }

    const offer = await prisma.voucherOffer.create({
      data: {
        id: finalId,
        name,
        duration: finalDuration || "1 Hour",
        durationMin: parseInt(durationMin) || 60,
        expiryMode: expiryMode || body.expiry_mode || "CONTINUOUS",
        price: parseFloat(price),
        maxDevices: parseInt(maxDevices) || parseInt(body.max_devices) || 1,
        downloadLimit: downloadLimit || body.download_limit || "5M",
        uploadLimit: uploadLimit || body.upload_limit || "5M",
        dataLimitMB: finalDataLimit,
        speedLimit: `${uploadLimit || body.upload_limit || "5M"}/${downloadLimit || body.download_limit || "5M"}`,
        siteId: siteId || 'default-site'
      }
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id, name, duration, price, max_devices,
      download_limit, upload_limit, expiry_mode,
      data_limit_mb, durationMin
    } = body;

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const finalDataLimit = data_limit_mb ? parseInt(data_limit_mb) : (body.dataLimitMB ? parseInt(body.dataLimitMB) : null);

    const offer = await prisma.voucherOffer.update({
      where: { id },
      data: {
        name,
        duration,
        durationMin: durationMin ? parseInt(durationMin) : undefined,
        expiryMode: expiry_mode || body.expiryMode || "CONTINUOUS",
        price: parseFloat(price),
        maxDevices: parseInt(max_devices) || parseInt(body.maxDevices) || 1,
        downloadLimit: download_limit || body.downloadLimit || "5M",
        uploadLimit: upload_limit || body.uploadLimit || "5M",
        dataLimitMB: finalDataLimit,
        speedLimit: `${upload_limit || body.uploadLimit || "5M"}/${download_limit || body.downloadLimit || "5M"}`,
      }
    });

    return NextResponse.json(offer);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await prisma.voucherOffer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
