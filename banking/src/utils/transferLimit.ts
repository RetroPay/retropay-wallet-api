interface CurrencyLimits {
  min: number;
  max: number;
}

export const transferLimit = async (currency: string, amount: number) => {
  const transferValues: Record<string, CurrencyLimits> = {
    KES: {
      min: 20,
      max: 200000,
    },
    GHS: {
      min: 1,
      max: 5000,
    },
    XAF: {
      min: 500,
      max: 500000,
    },
    USD: {
      min: 5,
      max: 2000,
    },
    NGN: {
        min: 100,
        max: 500000
    },
    NGN_X: {
        min: 100,
        max: 500000
    }
  };

  const currencyLimit = transferValues[currency];

  if(!currencyLimit) throw new Error("Currency not supported.")

  if (amount < currencyLimit.min)
    throw new Error(`The minimum transfer amount is ${currencyLimit.min}.`);

  if (amount > currencyLimit.max)
    throw new Error(`The maximum transfer amount is ${currencyLimit.max}.`);

  return;
};
