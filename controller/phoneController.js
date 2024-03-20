const phone = require("../model/phoneModel");

exports.saveNumber = async function (number) {
  const newNumber = new phone({
    phoneNum: number,
  });
  await newNumber.save();
};

exports.getAllPhoneNumbers = async () => {
  const allNumbers = await phone.find({});
  return allNumbers;
};
