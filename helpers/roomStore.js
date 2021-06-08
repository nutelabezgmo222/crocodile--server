import randomId from "./random.js";
import fs from "fs";
import path from "path";

const __dirname = path.resolve();
const maxRoomUsers = 3;

class RoomStore {
  createNewRoom(host, isRoomOpen) {}
  getAllOpenedRooms() {}
  joinRoom(roomID, user) {}
  leaveRoom(roomID, userID) {}
  findOpenRoom() {}
  isRoomAvailable(roomID, userID) {}
  kickUser(roomID, hostID, userID) {}
  setRoomWord(roomID, word) {}
  changeLeader(roomID) {}
  removeRoom(roomID) {}
  setRoomStatus(roomID, isPrivate) { }
}

export class InMemoryRoomStore extends RoomStore {
  constructor() {
    super();
    this.rooms = {
      openedRoomsID: [],
      allRooms: {},
    };
    this.kickUser = this.roomDecorator(this.kickUser);
    this.isRoomAvailable = this.roomDecorator(this.isRoomAvailable);
    this.leaveRoom = this.roomDecorator(this.leaveRoom);
    this.getRoomUsers = this.roomDecorator(this.getRoomUsers);
    this.setRoomWord = this.roomDecorator(this.setRoomWord);
    this.getRoom = this.roomDecorator(this.getRoom);
    this.changeLeader = this.roomDecorator(this.changeLeader);
    this.removeRoom = this.roomDecorator(this.removeRoom);
    this.setRoomStatus = this.roomDecorator(this.setRoomStatus);
  }
  setRoomStatus(roomID, isPrivate) {
    let room = this.rooms.allRooms[roomID];
    room.isRoomOpen = !isPrivate;
    let newOpenedRoomsID = this.rooms.openedRoomsID.filter(id => id !== roomID);
    if (!isPrivate) {
      newOpenedRoomsID.push(roomID);
    }
    this.rooms.openedRoomsID = newOpenedRoomsID;
  }
  removeRoom(roomID) {
    this.rooms.openedRoomsID = this.rooms.openedRoomsID.filter(id => id !== roomID);
    delete this.rooms.allRooms[roomID];
    try {
      fs.unlinkSync(path.resolve(__dirname, "files", `${roomID}.jpg`));
      //file removed
    } catch (err) {
      console.error(err);
    }
  }
  changeLeader(roomID) { 
    let room = this.rooms.allRooms[roomID];
    if (room.users.length) {
      let nextLeaderIndex;
      let curLeaderIndex = room.users.findIndex(
        (user) => user.userID === room.roomLeaderID
      );

      if (curLeaderIndex === -1) {
        nextLeaderIndex = 0;
      } else {
        nextLeaderIndex =
          curLeaderIndex + 1 <= room.users.length - 1
            ? curLeaderIndex + 1
            : 0;
      }
      room.roomLeaderID = room.users[nextLeaderIndex].userID;
    } else { 
      this.removeRoom(roomID);
    }
  }
  setRoomWord(roomID, word) {
    let room = this.rooms.allRooms[roomID];
    room.roomWord = word;
    return room.users;
  }
  getRoom(roomID) {
    return this.rooms.allRooms[roomID];
  }
  kickUser(roomID, hostID, userID) {
    let room = this.rooms.allRooms[roomID];
    if (hostID === room.roomHostID) {
      let removedUser = this.leaveRoom(roomID, userID);
      room.blockedUsersID.push(userID);
      let response = {
        status: "success",
        message: "User was kicked from lobby",
        removedUser: removedUser,
      };
      return response;
    }
    let response = {
      status: "error",
      message: "SocketID is not equal to RoomHostID",
    };
    return response;
  }
  getRoomUsers(roomID) {
    return this.rooms.allRooms[roomID].users;
  }
  isRoomAvailable(roomID, userID) {
    if (this.rooms.allRooms[roomID].users.length >= maxRoomUsers) {
      let response = {
        status: "error",
        message: {
          title: "Комната полная",
          body: "Попросите вашего друга кого нибудь кикнуть",
        },
      };
      return response;
    }
    if (this.rooms.allRooms[roomID].blockedUsersID.indexOf(userID) !== -1) {
      let response = {
        status: "error",
        message: {
          title: "Вас кикнули из игры",
          body: "Вы больше не сможете сюда зайти :(",
        },
      };
      return response;
    }
    let response = {
      status: "success",
      message: "Room is exist",
    };
    return response;
  }
  leaveRoom(roomID, userID) {
    let removedUser = null;
    const newRoomUsers = this.rooms.allRooms[roomID].users.filter((user) => {
      if (user.userID !== userID) {
        return true;
      } else {
        removedUser = user;
        return false;
      }
    });
    this.rooms.allRooms[roomID].users = newRoomUsers;
    return removedUser;
  }
  joinRoom(roomID, user) {
    let response = this.isRoomAvailable(roomID, user.userID);
    if (response.status === "success") {
      this.rooms.allRooms[roomID].users.push({
        username: user.username,
        userID: user.userID,
        socketID: user.socketID,
        avatarID: user.avatarID,
        pointCount: 0,
      });
      response.hostID = this.rooms.allRooms[roomID].roomHostID;
      return response;
    }
    return response;
  }
  getAllOpenedRooms() {
    return this.rooms.openedRoomsID;
  }
  createNewRoom(host, isRoomOpen) {
    const room = {
      roomID: randomId(),
      roomHostID: host.userID,
      roomHostSocketID: host.socketID,
      roomLeaderID: null,
      users: [],
      messages: [],
      roomWord: "",
      timer: null,
      gameCounter: 180,
      blockedUsersID: [],
      isRoomOpen: isRoomOpen,
      isGameStarted: false,
      isRoundStarted: false
    };
    this.rooms.allRooms[room.roomID] = room;
    if (isRoomOpen) {
      this.rooms.openedRoomsID.push(room.roomID);
    }
    return room.roomID;
  }
  findOpenRoom() {
    let url = this.rooms.openedRoomsID.find(id => {
      if (this.rooms.allRooms[id].users.length < 5) {
        return true;
      }
      return false;
    })
    if (!url) {
      url = null;
    }
    return url;
  }

  roomDecorator(func) {
    return function (roomID, ...rest) {
      if (roomID in this.rooms.allRooms) {
        return func.call(this, roomID, ...rest);
      } else {
        let response = {
          status: "error",
          message: {
            title: "Комната не существует",
            body: "Данной комнаты уже нет, а может и не было 0_0",
          },
        };
        return response;
      }
    };
  }
}
