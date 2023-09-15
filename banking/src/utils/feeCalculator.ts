export const calculateFees = async (
  currency: string,
  amount: number
): Promise<number> => {
  currency = currency.toUpperCase();

  switch (currency) {
    case "USD":
      return 5; // 5 dollar
      break;
    case "NGN_X":
      return 20; // 20 naira
      break;
    case "NGN":
      return 30;
      break;
    case "GHS":
      return amount * (3 / 100);
      break;
    case "XAF":
      return amount * (3 / 100);
      break;
    case "KES":
      return amount * (3 / 100);
      break;
    default:
      return 0;
      break;
  }
};
