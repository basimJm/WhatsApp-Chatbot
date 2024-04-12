const token = process.env.TOKEN;
const mytoken = process.env.MYTOKEN;
const axios = require("axios");
const OpenAi = require("openai");
const userModel = require("../model/phoneModel");
const ChatHistoryModel = require("../model/chatHistorymodel");
const ApiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");

const { saveNumber } = require("./phoneController");
const { updateStatus } = require("./botMessageController");
const openai = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

async function aiAnswer(msg_body, phoneNum, next) {
  const user = await userModel
    .findOne({ phoneNum: phoneNum })
    .populate("chatHistory");

  if (!user) {
    return next(new ApiError("User not found", 404));
  }
  const chatHistoryMessages = await ChatHistoryModel.find({
    _id: { $in: user.chatHistory },
  });

  let dbAnswer = "";
  for (let storedMessage of chatHistoryMessages) {
    if (storedMessage.userMessage === msg_body) {
      console.log(`answer from DB : ${storedMessage.aiMessage}`);
      dbAnswer = storedMessage.aiMessage;
      break;
    }
  }

  if (dbAnswer !== "" || dbAnswer !== null) {
    return dbAnswer;
  }

  const message = user.chatHistory.flatMap((msg) => [
    {
      role: "user",
      content: msg.userMessage,
    },
    {
      role: "assistant",
      content: msg.aiMessage,
    },
  ]);

  message.push({ role: "user", content: msg_body });

  const chatCompletion = await openai.chat.completions.create({
    messages: message,
    model: "gpt-3.5-turbo",
  });
  const aiMessage = chatCompletion.choices[0].message.content;

  const newChatHistory = {
    userMessage: msg_body,
    aiMessage: aiMessage,
  };

  const newChats = await ChatHistoryModel.create(newChatHistory);

  user.chatHistory.push(newChats);

  await user.save();

  return chatCompletion.choices[0].message.content;
}

exports.getWebhookMessage = async (req, res) => {
  let mode = req.query["hub.mode"];
  let challange = req.query["hub.challenge"];
  let token = req.query["hub.verify_token"];

  if (mode && token) {
    if (mode === "subscribe" && token === mytoken) {
      res.status(200).send(challange);
    } else {
      res.status(403);
    }
  }
};

exports.postWeebhook = async (req, res, next) => {
  let body_param = req.body;

  try {
    const hasStatuses = body_param.entry.some((entry) =>
      entry.changes.some((change) => change.value.hasOwnProperty("statuses"))
    );

    if (hasStatuses) {
      console.log("The body contains statuses");
      for (const entry of body_param.entry) {
        for (const change of entry.changes) {
          for (const status of change.value.statuses) {
            if (status.status !== "status") {
              await updateStatus(status.id, status.status);
            }
          }
        }
      }
    }

    console.log(JSON.stringify(body_param, null, 2));

    if (body_param.object) {
      console.log("inside body param");
      if (
        body_param.entry &&
        body_param.entry[0].changes &&
        body_param.entry[0].changes[0].value.messages &&
        body_param.entry[0].changes[0].value.messages[0]
      ) {
        let phon_no_id =
          body_param.entry[0].changes[0].value.metadata.phone_number_id;
        let from = body_param.entry[0].changes[0].value.messages[0].from;
        let msg_body =
          body_param.entry[0].changes[0].value.messages[0].text.body;

        console.log("phone number " + phon_no_id);
        console.log("from " + from);
        console.log("body param " + msg_body);
        await saveNumber(from, phon_no_id, next);
        let aiMessage = await aiAnswer(msg_body, from, next);
        await axios({
          method: "POST",
          url: `https://graph.facebook.com/v13.0/${phon_no_id}/messages?access_token=${process.env.TOKEN}`,
          data: {
            messaging_product: "whatsapp",
            to: from,
            text: {
              body: aiMessage,
            },
          },
          headers: {
            "Content-Type": "application/json",
          },
        });

        res.sendStatus(200);
      } else {
        res.sendStatus(404);
      }
    }
  } catch (error) {
    console.error("Unhandled Error:", error);
    res.sendStatus(500);
  }
};
