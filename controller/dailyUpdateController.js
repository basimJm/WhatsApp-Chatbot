const axios = require("axios");
const cron = require("node-cron");
const token = process.env.TOKEN;

const messageModel = require("../model/botMessageModel");

const { getAllPhoneNumbers, findNumberId } = require("./phoneController");
const {
  saveMessageId,
  getAllDailyMessages,
} = require("./botMessageController");

exports.scheduleReminderMessage = async function () {
  const messages = await getAllDailyMessages();

  for (const message of messages) {
    if (message.status === "delivered" || message.status === "sent") {
      const number = await findNumberId(message.receiverId);
      console.log(
        `number is ${number.phoneNum} and id is ${number.phoneNumId}`
      );
      cron.schedule("0 * * * *", async () => {
        await checkAndSendReminder(
          message.messageId,
          number.phoneNumId,
          number.phoneNum
        );
      });
    }
  }
};

async function checkAndSendReminder(messageId, phoneNumId, phoneNum) {
  const currentMessage = await messageModel.findOne({ messageId: messageId });
  if (
    currentMessage.status === "delivered" ||
    currentMessage.status === "sent"
  ) {
    await snedReminderMessage(phoneNumId, phoneNum);
  }
}
async function snedReminderMessage(phoneNumId, phoneNum) {
  axios({
    method: "POST",
    url:
      `https://graph.facebook.com/v13.0/${phoneNumId}/messages?access_token=` +
      token,
    data: {
      messaging_product: "whatsapp",
      to: `${phoneNum}`,
      text: {
        body: "Reminder!! : please send your update as soon as possible",
      },
    },
    headers: {
      "Content-Type": "application/json",
    },
  }).then((response) => {
    console.log(`response is ${JSON.stringify(response.data, null, 2)}`);
  });
}

exports.schedualeDailyUpdateMessage = async function () {
  let serverTimeZone = "Asia/Amman";
  cron.schedule(
    "00 09 * * *",
    async () => {
      const studentsId = await getAllPhoneNumbers();

      studentsId.then(async (students) => {
        students.forEach(async (studendId) => {
          await sendDailyUpdateMessage(
            studendId.phoneNumId,
            studendId.phoneNum
          );
        });
      });

      console.log("This message logs every two seconds");
    },
    {
      scheduled: true,
      timezone: serverTimeZone,
    }
  );
};
async function sendDailyUpdateMessage(phoneNumId, phoneNum) {
  axios({
    method: "POST",
    url:
      `https://graph.facebook.com/v13.0/${phoneNumId}/messages?access_token=` +
      token,
    data: {
      messaging_product: "whatsapp",
      to: `${phoneNum}`,
      text: {
        body: "Hi Please send your update",
      },
    },
    headers: {
      "Content-Type": "application/json",
    },
  }).then((response) => {
    console.log(`response is ${JSON.stringify(response.data, null, 2)}`);
    const messageId = response.data.messages[0].id;
    const receiverId = response.data.contacts[0].wa_id;
    saveMessageId(messageId, receiverId);
  });
}
