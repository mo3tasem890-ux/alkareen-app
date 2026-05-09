const fs = require('fs');
const file = 'e:\\\\Alkreen Production 1\\\\App.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/#0A1A2F/g, '#0B0F19'); // Main background
code = code.replace(/#112244/g, '#151B2B'); // Cards background
code = code.replace(/#2563EB/g, '#E2B93B'); // Old Blue to Gold

code = code.replace(
  `addBtnText: {
    color: '#FFFFFF',`,
  `addBtnText: {
    color: '#0B0F19',`
);

code = code.replace(
  `modalButtonText: {
    color: '#FFFFFF',`,
  `modalButtonText: {
    color: '#0B0F19',`
);

code = code.replace(
  `pickerOptionTextSelected: {
    color: '#FFFFFF',`,
  `pickerOptionTextSelected: {
    color: '#0B0F19',`
);

code = code.replace(
  `modernPriceText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34C759',`,
  `modernPriceText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E2B93B',`
);

code = code.replace(
  `modernActionBtnPrimary: {
    flexDirection: 'row',
    backgroundColor: '#34C759',`,
  `modernActionBtnPrimary: {
    flexDirection: 'row',
    backgroundColor: '#E2B93B',`
);

code = code.replace(
  `modernActionBtnTextPrimary: {
    color: '#FFF',`,
  `modernActionBtnTextPrimary: {
    color: '#0B0F19',`
);

code = code.replace(
  `<Ionicons name="call" size={18} color="#FFF" />`,
  `<Ionicons name="call" size={18} color="#0B0F19" />`
);

code = code.replace(
  `modernActionBtnSecondary: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#007AFF',`,
  `modernActionBtnSecondary: {
    flexDirection: 'row',
    backgroundColor: 'rgba(226, 185, 59, 0.1)',
    borderWidth: 1,
    borderColor: '#E2B93B',`
);

code = code.replace(
  `modernActionBtnTextSecondary: {
    color: '#007AFF',`,
  `modernActionBtnTextSecondary: {
    color: '#E2B93B',`
);

code = code.replace(
  `<Ionicons name="location" size={18} color="#007AFF" />`,
  `<Ionicons name="location" size={18} color="#E2B93B" />`
);

code = code.replace(
  `modernDivider: {
    height: 1,
    backgroundColor: '#1E3A8A',`,
  `modernDivider: {
    height: 1,
    backgroundColor: '#1F2937',`
);

fs.writeFileSync(file, code, 'utf8');
console.log("Colors successfully replaced!");
