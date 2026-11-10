/** Single source of truth for Apex House prices. All amounts are NGN. */
export const SETTINGS = {
  // Unknown costs are intentionally null; never include them in an estimate.
  transportFareNGN: null,
  launchExtraHourRateNGN: null,
};

export const SERVICES = {
  communication: {
    label: "Apex Communication",
    services: [
      { id: "event-moderation", name: "Event Moderation and Panel Facilitation", description: "Thoughtful event moderation and panel facilitation.", offers: [
        { id: "hourly", label: "Hourly", mode: "virtual", unit: "hour", amount: 5000 },
        { id: "hourly", label: "Hourly", mode: "physical", unit: "hour", amount: 12000 },
      ] },
      { id: "launch-hosting", name: "Launch Hosting and Facilitation", description: "A polished welcome and facilitation for your launch.", extraHoursAllowed: true, offers: [
        { id: "base-package", label: "2-hour package", mode: "virtual", unit: "package", amount: 20000, includes: "2 hours" },
        { id: "base-package", label: "4-hour package", mode: "physical", unit: "package", amount: 80000, includes: "4 hours" },
      ] },
      { id: "event-community-management", name: "Event Community Management", description: "Daily community management (2 hours per day).", offers: [
        { id: "daily", label: "Daily block (2 hours)", mode: "virtual", unit: "day", amount: 15000 },
        { id: "daily", label: "Daily block (2 hours)", mode: "physical", unit: "day", amount: 15000 },
      ] },
      { id: "public-speaking", name: "Public Speaking", description: "Stories and ideas delivered with clarity and presence.", offers: [
        { id: "hourly", label: "Hourly", mode: "virtual", unit: "hour", amount: 10000 },
        { id: "hourly", label: "Hourly", mode: "physical", unit: "hour", amount: 20000 },
      ] },
    ],
  },
  consulting: {
    label: "Apex Consulting",
    services: [
      { id: "event-clarity-session", name: "Event Clarity Session", description: "One-to-one event planning clarity and direction.", offers: [
        { id: "hourly", label: "Hourly", mode: "virtual", unit: "hour", amount: 8000 },
        { id: "hourly", label: "Hourly", mode: "physical", unit: "hour", amount: 8000 },
      ] },
      { id: "event-advisory", name: "Event Advisory", description: "Ongoing event guidance and advisory support.", offers: [
        { id: "1-month", label: "1 month", mode: "virtual", unit: "package", amount: 35000 },
        { id: "2-months", label: "2 months", mode: "virtual", unit: "package", amount: 65000 },
        { id: "3-months", label: "3 months", mode: "virtual", unit: "package", amount: 100000 },
      ] },
    ],
    inquiryServices: [
      { id: "project-management", name: "Project Management", inquiryOnly: true, description: "Practical coordination to help keep your project organized, on schedule, and moving toward its goals.", offers: [
        { id: "scoped-project", label: "Project scope (price confirmed after review)", mode: "virtual", unit: "project", amount: 0 },
        { id: "scoped-project", label: "Project scope (price confirmed after review)", mode: "physical", unit: "project", amount: 0 },
      ] },
    ],
  },
  media: {
    label: "Apex Media",
    services: [
      { id: "brand-influencing", name: "Brand Influencing (WhatsApp status)", description: "Promotion on WhatsApp status for each 24-hour block.", offers: [
        { id: "24-hours", label: "24 hours", mode: "virtual", unit: "block", amount: 10000 },
      ] },
      { id: "brand-broadcast-amplification", name: "Brand Influencing and Broadcast Amplification (WhatsApp)", description: "WhatsApp status promotion with broadcast amplification per 24-hour block.", offers: [
        { id: "24-hours", label: "24 hours", mode: "virtual", unit: "block", amount: 20000 },
      ] },
      { id: "event-content-support", name: "Event Content Support", description: "Flyer captions, promotional write-ups, announcements, and event copywriting.", offers: [
        { id: "per-content", label: "Per content piece", mode: "virtual", unit: "content", amount: 3000 },
      ] },
    ],
  },
};

export function readServiceIdsFromUrl(search = globalThis.location?.search ?? "") {
  const validIds = new Set(Object.values(SERVICES).flatMap((group) => [...group.services, ...(group.inquiryServices || [])].map((service) => service.id).filter(Boolean)));
  const params = new URLSearchParams(search);
  const requested = [params.get("service"), params.get("services")].filter(Boolean).join(",");
  return [...new Set(requested.split(",").filter((serviceId) => validIds.has(serviceId)))];
}

export function getService(serviceId) {
  for (const [category, group] of Object.entries(SERVICES)) {
    const service = [...group.services, ...(group.inquiryServices || [])].find((item) => item.id === serviceId);
    if (service) return { ...service, category, categoryLabel: group.label };
  }
  return null;
}

export function getOffer(serviceId, mode, offerId) {
  return getService(serviceId)?.offers?.find((item) => item.id === offerId && item.mode === mode) ?? null;
}

export function calculatePrice(serviceId, mode, offerId, quantity, extraHours = 0) {
  const service = getService(serviceId);
  const offer = getOffer(serviceId, mode, offerId);
  if (!service || !offer || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) return null;
  if (!Number.isSafeInteger(extraHours) || extraHours < 0 || extraHours > 1000) return null;
  if (extraHours && !service.extraHoursAllowed) return null;
  const extraAmount = service.extraHoursAllowed && SETTINGS.launchExtraHourRateNGN != null
    ? extraHours * SETTINGS.launchExtraHourRateNGN
    : 0;
  return { service, offer, quantity, extraHours, amount: offer.amount * quantity + extraAmount };
}
