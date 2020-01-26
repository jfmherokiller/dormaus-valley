Get-ChildItem ..\img | ForEach-Object {
     "icons.push({'iconFilePath':'img/$($_.Name )', 'iconValue':'$($_.BaseName)'});" 
    } | Out-File exported.js -Append -Encoding utf8