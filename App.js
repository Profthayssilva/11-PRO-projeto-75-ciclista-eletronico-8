import React, { Component } from "react";
import { Rajdhani_600SemiBold } from "@expo-google-fonts/rajdhani";
import * as Font from "expo-font";

import LoginScreen from "./screens/Login";
import BottomTabNavigator from "./components/BottomTabNavigator";

import { createSwitchNavigator, createAppContainer } from "react-navigation";

// Componente principal da aplicação
export default class App extends Component {
  constructor() {
    super();
    this.state = {
      fontLoaded: false
    };
  }

  // Método para carregar as fontes necessárias
  async loadFonts() {
    await Font.loadAsync({
      Rajdhani_600SemiBold: Rajdhani_600SemiBold
    });
    this.setState({ fontLoaded: true });
  }

  // Método chamado após o componente ser montado
  componentDidMount() {
    this.loadFonts();
  }

  // Renderização do componente
  render() {
    const { fontLoaded } = this.state;
    if (fontLoaded) {
      return <AppContainer />;
    }
    return null;
  }
}

// Configuração de navegação da aplicação
const AppSwitchNavigator = createSwitchNavigator(
  {
    Login: {
      screen: LoginScreen
    },
    BottomTab: {
      screen: BottomTabNavigator
    }
  },
  {
    initialRouteName: "Login"
  }
);

// Container da aplicação que usa o navegador de comutação (switch navigator)
const AppContainer = createAppContainer(AppSwitchNavigator);