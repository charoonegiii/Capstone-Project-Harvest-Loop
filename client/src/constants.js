export const RESIDUE_TYPES = [
  { value: 'paddy_straw', label: 'Paddy straw' },
  { value: 'wheat_straw', label: 'Wheat straw (bhusa)' },
  { value: 'sugarcane_residue', label: 'Sugarcane residue' },
  { value: 'cotton_stalk', label: 'Cotton stalks' },
  { value: 'maize_stalk', label: 'Maize stalks' },
  { value: 'mustard_stalk', label: 'Mustard stalks' },
  { value: 'rice_husk', label: 'Rice husk' },
  { value: 'other', label: 'Other' },
];
export const typeLabel = (v) => (RESIDUE_TYPES.find((t) => t.value === v) || { label: v }).label;

export const UNITS = ['quintal', 'tonne', 'kg'];

export const BUYER_TYPES = [
  { value: 'compost', label: 'Compost manufacturer' },
  { value: 'biomass', label: 'Biomass energy plant' },
  { value: 'animal_feed', label: 'Animal-feed producer' },
  { value: 'fertilizer', label: 'Organic fertilizer maker' },
  { value: 'other', label: 'Other' },
];

// Quick location presets (Punjab, Haryana, Chandigarh) so users need no API key to set coordinates
export const CITIES = [
  { name: 'Amritsar', lat: 31.634, lng: 74.8723 },
  { name: 'Ambala', lat: 30.3782, lng: 76.7767 },
  { name: 'Barnala', lat: 30.3745, lng: 75.5487 },
  { name: 'Bathinda', lat: 30.211, lng: 74.9455 },
  { name: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
  { name: 'Faridkot', lat: 30.67, lng: 74.75 },
  { name: 'Fatehgarh Sahib', lat: 30.644, lng: 76.39 },
  { name: 'Ferozepur', lat: 30.9331, lng: 74.6225 },
  { name: 'Gurdaspur', lat: 32.04, lng: 75.405 },
  { name: 'Hoshiarpur', lat: 31.5143, lng: 75.9115 },
  { name: 'Jalandhar', lat: 31.326, lng: 75.5762 },
  { name: 'Kapurthala', lat: 31.38, lng: 75.38 },
  { name: 'Karnal', lat: 29.6857, lng: 76.9905 },
  { name: 'Ludhiana', lat: 30.901, lng: 75.8573 },
  { name: 'Moga', lat: 30.816, lng: 75.174 },
  { name: 'Mohali', lat: 30.7046, lng: 76.7179 },
  { name: 'Muktsar', lat: 30.4762, lng: 74.516 },
  { name: 'Patiala', lat: 30.3398, lng: 76.3869 },
  { name: 'Rupnagar', lat: 30.966, lng: 76.533 },
  { name: 'Sangrur', lat: 30.2458, lng: 75.8421 },
];

export const STATUS = {
  requested: { label: 'Requested', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  transporter_assigned: { label: 'Transporter assigned', tone: 'violet' },
  picked_up: { label: 'Picked up', tone: 'teal' },
  delivered: { label: 'Delivered', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  pending: { label: 'Pending', tone: 'amber' },
  countered: { label: 'Counter-offer', tone: 'violet' },
  accepted: { label: 'Accepted', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  withdrawn: { label: 'Withdrawn', tone: 'gray' },
  active: { label: 'Active', tone: 'green' },
  sold: { label: 'Sold out', tone: 'gray' },
  removed: { label: 'Removed', tone: 'red' },
};

export const BOOKING_FLOW = ['requested', 'confirmed', 'transporter_assigned', 'picked_up', 'delivered'];

export const inr = (n) =>
  n === null || n === undefined ? '-' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const num = (n, d = 1) =>
  n === null || n === undefined ? '-' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d });

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '-';
