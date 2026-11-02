/** The only place contact details are masked. */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  const dot = domain.indexOf(".");
  const host = dot === -1 ? domain : domain.slice(0, dot);
  const tld = dot === -1 ? "" : domain.slice(dot);
  return `${local[0]}•••@${host[0]}•••${tld}`;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `+91 ••••• ••${digits.slice(-3)}`;
}
