import './Colors.css'

export const checkDarkMode = (darkMode, selectedElem = false) => {
    let selected = "";
    let notSelected = "";

    if(darkMode) {
        selected = ' buttonsSelectedDarkMode';
        notSelected = ' buttonsDarkMode';
    } else {
        selected = ' buttonsSelectedLightMode';
        notSelected = ' buttonsLightMode';
    }

    return selectedElem ? selected : notSelected;
}

export const checkDarkModeEditor = () => {
    let selected = "";

    selected = ' backgroundLightMode buttonsSelectedLightMode';
    
    return selected;
}

export const checkDarkModeLinks = (darkMode) => {
    if(darkMode) 
        return ' linksDarkMode';
    else 
        return ' linksLightMode';
}

export const checkDarkModeBackground = (darkMode) => {
    let element = null;
    
    if (darkMode){
        element = document.getElementById("root")
        element.classList.remove('backgroundLightMode');
        element.classList.add('backgroundDarkMode');
        return ' backgroundDarkMode'
    } else
        element = document.getElementById("root")
        element.classList.add('backgroundLightMode');
        element.classList.remove('backgroundDarkMode')
        return ' backgroundLightMode'
}