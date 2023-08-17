export type usdAccountMeta = {
  occupation: string;
  utility_bill: string; //image url or file
  bank_statement: string; //pdf url or file
  identity_type: string; // only passport can be used right now
  identity_image: string; // passport photo url or file
  identity_number: string; //passport number
  identity_issued_date: Date; //passport issuance date. Format: YYYY-MM-DD,
  identity_expiration: Date;
};

export type usdRecipientInfo = {
  first_name: string;
  last_name: string;
  address: string;
  phone_number: string;
  country: string;
};
