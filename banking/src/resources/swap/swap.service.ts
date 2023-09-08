import axios from "axios";
import logger from "@/utils/logger";
import swapModel from "./swap.model";
import userModel from "../user/user.model";
import translateError from "@/helpers/mongod.helper";
import { checkCurrenciesAvailability } from "@/utils/checkCurrency";
import { transferLimit } from "@/utils/transferLimit";
import { v4 } from "uuid";
import ISwap from "./swap.interface";
import walletModel from "../wallet/wallet.model";

class SwapService {
  public async generateSwapQuote(
    source_currency: string,
    target_currency: string,
    amount: number,
    userId: string
  ): Promise<ISwap> {
    try {
      await checkCurrenciesAvailability(source_currency);
      await checkCurrenciesAvailability(target_currency);

      await transferLimit(source_currency, amount);

      const foundUser = await userModel.findOne({
        _id: userId,
        $and: [
          {
            "currencyAccounts.currency": source_currency,
            "currencyAccounts.status": "approved",
            "currencyAccounts.isActive": true,
          },
          {
            "currencyAccounts.currency": target_currency,
            "currencyAccounts.status": "approved",
            "currencyAccounts.isActive": true,
          },
        ],
      });

      logger(foundUser);

      if (!foundUser)
        throw new Error(
          `Create an active ${source_currency} or ${target_currency} account to swap funds.`
        );

      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://api.maplerad.com/v1/fx/quote"
            : "https://sandbox.api.maplerad.com/v1/fx/quote",
        data: {
          source_currency:
            source_currency.toUpperCase() == "NGN_X" ? "NGN" : source_currency,
          target_currency:
            target_currency.toUpperCase() == "NGN_X" ? "NGN" : target_currency,
          amount: amount * 100,
        },
        headers: {
          Authorization: `Bearer ${process.env.MAPLERAD_SECRET_KEY}`,
        },
      });

      const quote = response.data.data;

      const { reference, source, target, rate } = quote;

      const newQuote = await swapModel.create({
        reference,
        source: {
          currency: source_currency,
          amount: source.amount,
          human_readable_amount: source.human_readable_amount,
        },
        target: {
          currency: target_currency,
          amount: target.amount,
          human_readable_amount: target.human_readable_amount,
        },
        rate,
        userId: userId,
        isInitiated: false,
      });

      logger(newQuote);

      if (!newQuote) throw new Error("Unable to retrieve fx quote, try again.");

      return newQuote;
    } catch (error: any) {
      logger(error);
      throw new Error(
        error?.response?.data?.message ||
          translateError(error)[0] ||
          "Unable to swap funds. try again."
      );
    }
  }

  public async swapFunds(reference: string, userId: string): Promise<ISwap> {
    try {
      const quote = await swapModel.findOne({
        reference,
      });

      if (!quote) throw new Error("Exchange quote not found.");

      if (quote.userId != userId)
        throw new Error("Unable to swap funds. try again");

      if (quote.isInitiated)
        throw new Error("Quote expired, generate a new exchange quote.");

      const { source, target } = quote;

      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://api.maplerad.com/v1/fx"
            : "https://sandbox.api.maplerad.com/v1/fx",
        data: {
          quote_reference: reference,
        },
        headers: {
          Authorization: `Bearer ${process.env.MAPLERAD_SECRET_KEY}`,
        },
      });

      const exchangedQuote = response.data.data;

      if (!exchangedQuote) throw new Error("Unable to swap funds. try again.");
      logger(exchangedQuote);

      const updatedQuote = await swapModel.findOneAndUpdate(
        {
          reference,
        },
        {
          isInitiated: true,
        },
        { new: true }
      );

      await walletModel.insertMany([
        {
          transactionType: "swap",
          currency: target.currency,
          fundRecipientAccount: userId,
          status: "success",
          amount: target.human_readable_amount,
          referenceId: "swap" + v4(),
          swapQuoteReference: reference,
          comment: `Swap ${source.currency} to ${target.currency}`
        },
        {
          transactionType: "swap",
          currency: source.currency,
          fundOriginatorAccount: userId,
          status: "success",
          amount: source.human_readable_amount,
          referenceId: "swap" + v4(),
          swapQuoteReference: reference,
          comment: `Swap ${source.currency} to ${target.currency}`
        },
      ]); 
      
      if(!updatedQuote) throw new Error("Funds exchange pending.")

      return updatedQuote;
    } catch (error: any) {
      logger(error);
      throw new Error(
        error?.response?.data?.message ||
          translateError(error)[0] ||
          "Unable to swap funds. try again."
      );
    }
  }
}

export default SwapService;
