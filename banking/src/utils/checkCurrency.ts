import logger from "./logger";

export const checkCurrenciesAvailability = async (currency: string): Promise <void> => {
  logger(currency);
  if(!currency) throw new Error("Include valid currency.")
  
  const currencies = ["XAF", "NGN", "USD", "GHS", "KES", "NGN_X"];

  currency = currency.toUpperCase();

  if (!currencies.includes(currency))
    throw new Error("Currency not supported.");

  return;
};
