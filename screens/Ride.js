import React, { Component } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ImageBackground,
  Image,
  Alert,
  KeyboardAvoidingView,
  ToastAndroid
} from "react-native";
import * as Permissions from "expo-permissions";
import { BarCodeScanner } from "expo-barcode-scanner";
import firebase from "firebase";
import db from "../config";

// Importação de imagens e bibliotecas necessárias
const bgImage = require("../assets/background2.png");
const appIcon = require("../assets/appIcon.png");

export default class RideScreen extends Component {
  constructor(props) {
    super(props);
    // Estado inicial do componente
    this.state = {
      bikeId: "",
      userId: "",
      domState: "normal",
      hasCameraPermissions: null,
      scanned: false,
      bikeType: "",
      userName: "",
      email: firebase.auth().currentUser.email
    };
  }

  // Método chamado após a montagem do componente
  async componentDidMount() {
    const { email } = this.state;
    await this.getUserDetails(email);
  }

  // Método para obter permissões da câmera
  getCameraPermissions = async () => {
    const { status } = await Permissions.askAsync(Permissions.CAMERA);

    this.setState({
      hasCameraPermissions: status === "granted",
      domState: "scanner",
      scanned: false
    });
  };

  // Callback chamada quando um código de barras é escaneado
  handleBarCodeScanned = async ({ type, data }) => {
    this.setState({
      bikeId: data,
      domState: "normal",
      scanned: true
    });
  };

  // Lógica principal para processar a transação
  handleTransaction = async () => {
    var { bikeId, userId } = this.state;
    await this.getBikeDetails(bikeId);
    await this.getUserDetails(userId);

    var transactionType = await this.checkBikeAvailability(bikeId);

    if (!transactionType) {
      this.setState({ bikeId: "" });
      Alert.alert("Por favor insira/digitalize um ID válido");
    } else if (transactionType === "under_maintenance") {
      this.setState({
        bikeId: ""
      });
    } else if (transactionType === "rented") {
      var isEligible = await this.checkUserEligibilityForStartRide(userId);

      if (isEligible) {
        var { bikeType, userName } = this.state;
        this.assignBike(bikeId, userId, bikeType, userName);
        Alert.alert(
          "Você alugou a bicicleta pela próxima 1 hora. Aproveite seu passeio!!"
        );
        this.setState({
          bikeAssigned: true
        });
      }
    } else {
      var isEligible = await this.checkUserEligibilityForEndRide(
        bikeId,
        userId
      );

      if (isEligible) {
        var { bikeType, userName } = this.state;
        this.returnBike(bikeId, userId, bikeType, userName);
        Alert.alert("Esperamos que tenha gostado do seu passeio");
        this.setState({
          bikeAssigned: false
        });
      }
    }
  };

  // Método para obter detalhes da bicicleta do banco de dados
  getBikeDetails = bikeId => {
    bikeId = bikeId.trim();
    db.collection("bicycles")
      .where("id", "==", bikeId)
      .get()
      .then(snapshot => {
        snapshot.docs.map(doc => {
          this.setState({
            bikeType: doc.data().bike_type
          });
        });
      });
  };

  // Método para obter detalhes do usuário do banco de dados
  getUserDetails = email => {
    db.collection("users")
      .where("email_id", "==", email)
      .get()
      .then(snapshot => {
        snapshot.docs.map(doc => {
          this.setState({
            userName: doc.data().name,
            userId: doc.data().id,
            bikeAssigned: doc.data().bike_assigned
          });
        });
      });
  };

  // Método para verificar a disponibilidade da bicicleta
  checkBikeAvailability = async bikeId => {
    const bikeRef = await db
      .collection("bicycles")
      .where("id", "==", bikeId)
      .get();

    var transactionType = "";
    if (bikeRef.docs.length == 0) {
      transactionType = false;
    } else {
      bikeRef.docs.map(doc => {
        if (!doc.data().under_maintenance) {
          transactionType = doc.data().is_bike_available ? "Alugado" : "Retornar";
        } else {
          transactionType = "under_maintenance";
          Alert.alert(doc.data().maintenance_message);
        }
      });
    }

    return transactionType;
  };

  // Método para verificar a elegibilidade do usuário para iniciar um passeio
  checkUserEligibilityForStartRide = async (userId, email) => {
    const userRef = await db
      .collection("users")
      .where("id", "==", userId)
      .where("email_id", "==", email)
      .get();

    var isUserEligible = false;
    if (userRef.docs.length == 0) {
      this.setState({
        bikeId: ""
      });
      isUserEligible = false;
      Alert.alert("Id de Usuário inválido");
    } else {
      userRef.docs.map(doc => {
        if (!doc.data().bike_assigned) {
          isUserEligible = true;
        } else {
          isUserEligible = false;
          Alert.alert("Finalize o passeio atual para alugar outra bicicleta");
          this.setState({
            bikeId: ""
          });
        }
      });
    }

    return isUserEligible;
  };

  // Método para verificar a elegibilidade do usuário para encerrar um passeio
  checkUserEligibilityForEndRide = async (bikeId, userId, email) => {
    const transactionRef = await db
      .collection("transactions")
      .where("bike_id", "==", bikeId)
      .where("email_id", "==", email)
      .limit(1)
      .get();
    var isUserEligible = "";
    transactionRef.docs.map(doc => {
      var lastBikeTransaction = doc.data();
      if (lastBikeTransaction.user_id === userId) {
        isUserEligible = true;
      } else {
        isUserEligible = false;
        Alert.alert("Essa bicicleta está alugada por outro usuário");
        this.setState({
          bikeId: ""
        });
      }
    });
    return isUserEligible;
  };

  // Método para atribuir uma bicicleta ao usuário
  assignBike = async (bikeId, userId, bikeType, userName) => {
    db.collection("transactions").add({
      user_id: userId,
      user_name: userName,
      bike_id: bikeId,
      bike_type: bikeType,
      date: firebase.firestore.Timestamp.now().toDate(),
      transaction_type: "rented",
      email_id: email
    });
    db.collection("bicycles")
      .doc(bikeId)
      .update({
        is_bike_available: false
      });
    db.collection("users")
      .doc(userId)
      .update({
        bike_assigned: true
      });

    this.setState({
      bikeId: ""
    });
  };

  // Método para retornar uma bicicleta ao sistema
  returnBike = async (bikeId, userId, bikeType, userName) => {
    db.collection("transactions").add({
      user_id: userId,
      user_name: userName,
      bike_id: bikeId,
      bike_type: bikeType,
      date: firebase.firestore.Timestamp.now().toDate(),
      transaction_type: "return",
      email_id: email
    });
    db.collection("bicycles")
      .doc(bikeId)
      .update({
        is_bike_available: true
      });
    db.collection("users")
      .doc(userId)
      .update({
        bike_assigned: false
      });

    this.setState({
      bikeId: ""
    });
  };

  // Renderização do componente
  render() {
    const { bikeId, userId, domState, scanned, bikeAssigned } = this.state;
    if (domState !== "normal") {
      // Se o estado não for "normal", exibe o scanner de código de barras
      return (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : this.handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      );
    }
    // Renderiza a interface padrão
    return (
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View style={styles.upperContainer}>
          <Image source={appIcon} style={styles.appIcon} />
          <Text style={styles.title}>Ciclista Eletrônico</Text>
          <Text style={styles.subtitle}>Um passeio ecologicamente correto</Text>
        </View>
        <View style={styles.lowerContainer}>
          <View style={styles.textinputContainer}>
            <TextInput
              style={[styles.textinput, { width: "82%" }]}
              onChangeText={text => this.setState({ userId: text })}
              placeholder={"Id do Usuário"}
              placeholderTextColor={"#FFFFFF"}
              value={userId}
            />
          </View>
          <View style={[styles.textinputContainer, { marginTop: 25 }]}>
            <TextInput
              style={styles.textinput}
              onChangeText={text => this.setState({ bikeId: text })}
              placeholder={"Id da Bicicleta"}
              placeholderTextColor={"#FFFFFF"}
              value={bikeId}
              autoFocus
            />
            <TouchableOpacity
              style={styles.scanbutton}
              onPress={() => this.getCameraPermissions()}
            >
              <Text style={styles.scanbuttonText}>Digitalizar</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, { marginTop: 25 }]}
            onPress={this.handleTransaction}
          >
            <Text style={styles.buttonText}>
              {bikeAssigned ? "Finalizar" : "Desbloquear"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }
}

// Estilos do componente
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#D0E6F0"
  },
  bgImage: {
    flex: 1,
    resizeMode: "cover",
    justifyContent: "center"
  },
  upperContainer: {
    flex: 0.5,
    justifyContent: "center",
    alignItems: "center"
  },
  appIcon: {
    width: 200,
    height: 200,
    resizeMode: "contain",
    marginTop: 80
  },
  title: {
    fontSize: 40,
    fontFamily: "Rajdhani_600SemiBold",
    paddingTop: 20,
    color: "#4C5D70"
  },
  subtitle: {
    fontSize: 20,
    fontFamily: "Rajdhani_600SemiBold",
    color: "#4C5D70",
    marginBottom: 80
  },
  lowerContainer: {
    flex: 0.5,
    alignItems: "center"
  },
  textinputContainer: {
    borderWidth: 2,
    borderRadius: 10,
    flexDirection: "row",
    backgroundColor: "#4C5D70",
    borderColor: "#4C5D70"
  },
  textinput: {
    width: "57%",
    height: 50,
    padding: 10,
    borderColor: "#4C5D70",
    borderRadius: 10,
    borderWidth: 3,
    fontSize: 18,
    backgroundColor: "#F88379",
    fontFamily: "Rajdhani_600SemiBold",
    color: "#FFFFFF"
  },
  scanbutton: {
    width: 100,
    height: 50,
    backgroundColor: "#FBE5C0",
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: "center",
    alignItems: "center"
  },
  scanbuttonText: {
    fontSize: 20,
    color: "#4C5D70",
    fontFamily: "Rajdhani_600SemiBold"
  },
  button: {
    width: "43%",
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FBE5C0",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#4C5D70"
  },
  buttonText: {
    fontSize: 24,
    color: "#4C5D70",
    fontFamily: "Rajdhani_600SemiBold"
  }
});