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

export const checkDarkModeBackground = (darkMode) => {
    if (darkMode)
        return ' backgroundDarkMode'
    else
        return ' backgroundLightMode'
}