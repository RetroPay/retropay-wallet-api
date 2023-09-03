interface ISwap {
  reference: string;
  source: {
    currency: string;
    amount: number;
    human_readable_amount: number;
  };
  target: {
    currency: string;
    amount: number;
    human_readable_amount: number;
  };
  rate: string;
  isInitiated: boolean;
  userId: string;
}

export default ISwap;