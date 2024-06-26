const phone = require("../model/phoneModel");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const stripe = require("stripe")(
  "sk_test_51OyMbA1D08DtjSM8pGX8yUA7PVcCRL5F86NjEmfsaIk10ax3DNlnIhK5Eb1kXymYzuxGGTNOQxq2M1fbU4r46VTj00bSTp3WfD"
);

exports.saveNumber = async function (number, phoneNumId, next) {
  const isNumberUsed = await phone.findOne({ phoneNum: number });
  if (isNumberUsed) {
    return next(new ApiError("number is already saved "), 403);
  }
  const newNumber = new phone({
    phoneNum: number,
    phoneNumId: phoneNumId,
  });
  await newNumber.save();
};

exports.getAllPhoneNumbers = async () => {
  const allNumbers = await phone.find({});
  return allNumbers;
};

exports.findNumberId = async function (phoneNum) {
  const mobile = await phone.findOne({ phoneNum: phoneNum });
  return mobile;
};

exports.getUserByPhoneNum = asyncHandler(async (phoneNum) => {
  const user = await phone.findOne({ phoneNum: phoneNum });
  if (!user) {
    console.log("user not found");
  }
  console.log(
    `user data for payment is ${user.requestNum} and ${user.isSubscriber}`
  );
  if (user.requestNum >= 2 && !user.isSubscriber) {
    return false;
  } else {
    return true;
  }
});

// get all cutomers in strip dashboard
exports.findAndUpdateUserSubscription = asyncHandler(
  async (req, res, next, webhookNumber) => {
    const customers = await stripe.customers.list();
    const user = await phone.findOne({ phoneNum: webhookNumber });
    if (!user || customers.data.length === 0) {
      const requestNum = user.requestNum + 1;
      await updateUserRequestNumber(webhookNumber, requestNum);
      await updateUserSubscription(user, webhookNumber, false);
      console.log(`update to false  after ! condition`);
      return next(new ApiError("user/customer not found", 404));
    } else {
      for (const data of customers.data) {
        const phonNum = data.phone.replace("+", "");
        if (phonNum === webhookNumber) {
          console.log(`update to true  after === condition`);
          await updateUserSubscription(user, phonNum, true);
        } else {
          console.log(`update to false  after === condition`);
          await updateUserSubscription(user, phonNum, false);
        }
      }
    }
  }
);

async function updateUserSubscription(user, phonNum, falg) {
  console.log(`user phone is ${user.phoneNum}`);
  await phone.findOneAndUpdate(
    { phoneNum: phonNum },
    { $set: { isSubscriber: falg } },
    { new: true }
  );
}

async function updateUserRequestNumber(phoneNum, requestNum) {
  await phone.findOneAndUpdate(
    { phoneNum: phoneNum },
    { requestNum: requestNum },
    { new: true }
  );
}
